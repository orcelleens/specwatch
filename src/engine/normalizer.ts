import { createHash } from "node:crypto";
import SwaggerParser from "@apidevtools/swagger-parser";
import YAML from "yaml";
import * as cheerio from "cheerio";
import type { OpenAPI } from "openapi-types";
import type { NormalizedSpec, SourceKind } from "./types";
import { specFormatToSourceKind } from "./types";

/**
 * Universal normalizer.
 *
 * Every watchable source — OpenAPI, GraphQL, AsyncAPI, Postman, generic
 * JSON, docs HTML, plain text/Markdown — is converted to one canonical
 * tree shape so the existing deep-differ and severity classifier work
 * unchanged across all of them:
 *
 *   openapi   → the bundled OpenAPI document (legacy shape: `paths`, `components`)
 *   graphql   → `{ types: { <Type>: { kind, fields: { <field>: { type, args } }, enumValues? } } }`
 *   asyncapi  → the AsyncAPI document (`channels`, `operations`, `components`)
 *   postman   → `{ endpoints: { "<METHOD> <path>": { name, parameters, headers } }, info }`
 *   docs      → `{ sections: { <slug>: { heading, level, text, code } } }`
 *   json      → the parsed document, canonically ordered
 *   text      → `{ sections: { <slug>: { heading, level, text } } }` (split on headings)
 *
 * Invariants (unchanged from the OpenAPI-only era):
 * - volatile noise (`examples`, `x-*` extensions, …) is stripped;
 * - the tree is serialized with sorted keys and sha256-hashed;
 * - trees over MAX_TREE_BYTES are rejected.
 */

const VOLATILE_KEYS = new Set(["examples", "example", "externalDocs"]);
const MAX_TREE_BYTES = 40 * 1024 * 1024;
const MAX_SECTION_TEXT = 4_000;

function stripVolatile(node: unknown): unknown {
  if (Array.isArray(node)) {
    return node.map((item) => stripVolatile(item));
  }
  if (node && typeof node === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (VOLATILE_KEYS.has(k)) continue;
      // vendor extensions are noise, except deprecation signals
      if (k.startsWith("x-") && k !== "x-deprecated") continue;
      out[k] = stripVolatile(v);
    }
    return out;
  }
  return node;
}

function stableStringify(node: unknown): string {
  if (Array.isArray(node)) {
    return `[${node.map(stableStringify).join(",")}]`;
  }
  if (node && typeof node === "object") {
    const keys = Object.keys(node as Record<string, unknown>).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((node as Record<string, unknown>)[k])}`).join(",")}}`;
  }
  return JSON.stringify(node) ?? "null";
}

function finish(tree: unknown, detectedKind: SourceKind, specVersion?: string, title?: string): NormalizedSpec {
  const serialized = stableStringify(tree);
  if (Buffer.byteLength(serialized, "utf8") > MAX_TREE_BYTES) {
    throw new Error(`normalized tree exceeds ${MAX_TREE_BYTES} bytes`);
  }
  return {
    tree,
    hash: createHash("sha256").update(serialized).digest("hex"),
    specVersion,
    detectedKind,
    title,
  };
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** Try JSON first, then YAML. Returns undefined when neither parses to a value. */
function tryParseStructured(raw: string): unknown {
  const trimmed = raw.trimStart();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(raw);
    } catch {
      /* fall through to YAML */
    }
  }
  try {
    return YAML.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

const GRAPHQL_SDL_RE = /^\s*(schema|type|interface|input|enum|union|scalar|extend|directive)\b/m;

/**
 * Detect what kind of source a raw document is. Pure and synchronous so the
 * probe/discovery layer and tests can use it without fetching anything.
 * `hint` only breaks ties (e.g. a docs URL that returns plain text).
 */
export function detectSourceKind(raw: string, hint?: SourceKind): SourceKind {
  const trimmed = raw.trimStart();
  if (!trimmed) return hint ?? "text";

  // HTML is unambiguous.
  if (/^<!doctype html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) return "docs";

  const parsed = tryParseStructured(raw);
  if (isRecord(parsed) || Array.isArray(parsed)) {
    if (isRecord(parsed)) {
      if (typeof parsed.openapi === "string" || typeof parsed.swagger === "string") return "openapi";
      if (typeof parsed.asyncapi === "string") return "asyncapi";
      const info = parsed.info;
      if (isRecord(info) && typeof info.schema === "string" && info.schema.includes("getpostman")) {
        return "postman";
      }
      if (isRecord(parsed.__schema)) return "graphql";
      if (isRecord(parsed.data) && isRecord((parsed.data as Record<string, unknown>).__schema)) {
        return "graphql";
      }
      if (Array.isArray(parsed.item) && isRecord(info)) return "postman";
    }
    // A structured document that is none of the known spec formats is still
    // watchable as generic JSON (a niche API's JSON schema, config, …).
    return "json";
  }

  if (GRAPHQL_SDL_RE.test(raw) && /[{:]/.test(raw)) return "graphql";
  if (hint === "docs") return "docs";
  return hint === "graphql" ? "graphql" : "text";
}

// ---------------------------------------------------------------------------
// OpenAPI (legacy path — behaviour preserved)
// ---------------------------------------------------------------------------

export function parseSpecDocument(raw: string): OpenAPI.Document {
  const trimmed = raw.trimStart();
  if (trimmed.startsWith("{")) {
    return JSON.parse(raw) as OpenAPI.Document;
  }
  return YAML.parse(raw) as unknown as OpenAPI.Document;
}

function isMissingRefError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === "MissingPointerError" || err.message.includes("Missing $ref pointer"))
  );
}

async function normalizeOpenApi(raw: string): Promise<NormalizedSpec> {
  const doc = parseSpecDocument(raw);
  // bundle() pulls external $refs into the document; internal refs stay as
  // literal $ref leaves. Pass a clone: bundle mutates its input.
  let bundled: OpenAPI.Document;
  try {
    bundled = await SwaggerParser.bundle(structuredClone(doc));
  } catch (err) {
    // vendors ship specs with broken internal $refs (e.g. Square). Degrade to
    // the raw document — its $ref leaves have the same shape bundle would
    // produce, so diffs stay consistent before and after the vendor fixes it.
    if (!isMissingRefError(err)) throw err;
    bundled = doc;
  }
  const tree = stripVolatile(bundled);
  return finish(tree, "openapi", bundled.info?.version ?? undefined, bundled.info?.title ?? undefined);
}

// ---------------------------------------------------------------------------
// GraphQL — introspection JSON and SDL
// ---------------------------------------------------------------------------

interface GqlTypeNode {
  kind: string;
  fields?: Record<string, { type: string; args: Record<string, { type: string; required: boolean }> }>;
  enumValues?: string[];
  description?: string;
}

function gqlTypeRef(ref: unknown): string {
  if (!isRecord(ref)) return "Unknown";
  if (ref.kind === "NON_NULL") return `${gqlTypeRef(ref.ofType)}!`;
  if (ref.kind === "LIST") return `[${gqlTypeRef(ref.ofType)}]`;
  return typeof ref.name === "string" ? ref.name : "Unknown";
}

function normalizeGraphqlIntrospection(root: Record<string, unknown>): NormalizedSpec {
  const schema = (isRecord(root.__schema) ? root.__schema : (root.data as Record<string, unknown>).__schema) as Record<string, unknown>;
  const types: Record<string, GqlTypeNode> = {};
  const rawTypes = Array.isArray(schema.types) ? schema.types : [];
  for (const t of rawTypes) {
    if (!isRecord(t) || typeof t.name !== "string" || t.name.startsWith("__")) continue;
    const node: GqlTypeNode = { kind: typeof t.kind === "string" ? t.kind : "OBJECT" };
    if (typeof t.description === "string" && t.description) node.description = t.description;
    const fields = t.fields ?? t.inputFields;
    if (Array.isArray(fields)) {
      node.fields = {};
      for (const f of fields) {
        if (!isRecord(f) || typeof f.name !== "string") continue;
        const args: GqlTypeNode["fields"] extends Record<string, infer F> ? F : never = {
          type: gqlTypeRef(f.type),
          args: {},
        } as never;
        if (Array.isArray(f.args)) {
          const argMap: Record<string, { type: string; required: boolean }> = {};
          for (const a of f.args) {
            if (!isRecord(a) || typeof a.name !== "string") continue;
            const type = gqlTypeRef(a.type);
            argMap[a.name] = { type, required: type.endsWith("!") && a.defaultValue == null };
          }
          (args as { args: typeof argMap }).args = argMap;
        }
        node.fields[f.name] = args as { type: string; args: Record<string, { type: string; required: boolean }> };
        if (f.isDeprecated === true) {
          (node.fields[f.name] as Record<string, unknown>)["deprecated"] = true;
        }
      }
    }
    if (Array.isArray(t.enumValues)) {
      node.enumValues = t.enumValues
        .filter(isRecord)
        .map((e) => e.name)
        .filter((n): n is string => typeof n === "string")
        .sort();
    }
    types[t.name] = node;
  }
  return finish({ types }, "graphql", undefined, "GraphQL schema");
}

/** Lightweight SDL normalizer: extracts type blocks without a full parser. */
function normalizeGraphqlSdl(raw: string): NormalizedSpec {
  const types: Record<string, GqlTypeNode> = {};
  const blockRe = /(type|interface|input|enum|union|scalar)\s+(\w+)[^{=]*(\{[^}]*\})?/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(raw)) !== null) {
    const [, keyword, name, body] = m;
    const node: GqlTypeNode = { kind: keyword.toUpperCase() };
    if (body) {
      const inner = body.slice(1, -1);
      if (keyword === "enum") {
        node.enumValues = inner
          .split(/\s+/)
          .map((s) => s.trim())
          .filter((s) => /^[A-Za-z_]\w*$/.test(s))
          .sort();
      } else {
        node.fields = {};
        // field signature: name(args)?: Type — fields are newline- or comma-separated
        for (const line of inner.split(/[\n,]/)) {
          const fm = line.match(/^\s*(\w+)\s*(?:\(([^)]*)\))?\s*:\s*([[\]\w!]+)/);
          if (!fm) continue;
          const [, fname, argStr, ftype] = fm;
          const args: Record<string, { type: string; required: boolean }> = {};
          if (argStr) {
            for (const part of argStr.split(",")) {
              const am = part.match(/(\w+)\s*:\s*([[\]\w!]+)/);
              if (am) args[am[1]] = { type: am[2], required: am[2].endsWith("!") };
            }
          }
          node.fields[fname] = { type: ftype, args };
          if (/@deprecated/.test(line)) {
            (node.fields[fname] as Record<string, unknown>)["deprecated"] = true;
          }
        }
      }
    }
    types[name] = node;
  }
  if (Object.keys(types).length === 0) {
    // Looks like SDL but nothing parsed — still watch it as text rather than fail.
    return normalizeText(raw, "graphql");
  }
  return finish({ types }, "graphql", undefined, "GraphQL schema");
}

// ---------------------------------------------------------------------------
// Postman Collection
// ---------------------------------------------------------------------------

function flattenPostmanItems(items: unknown, out: Record<string, unknown>): void {
  if (!Array.isArray(items)) return;
  for (const item of items) {
    if (!isRecord(item)) continue;
    if (Array.isArray(item.item)) {
      flattenPostmanItems(item.item, out);
      continue;
    }
    const req = item.request;
    if (!isRecord(req)) continue;
    const method = typeof req.method === "string" ? req.method.toUpperCase() : "GET";
    const url = req.url;
    let path = "";
    if (typeof url === "string") path = url;
    else if (isRecord(url)) {
      if (typeof url.raw === "string") path = url.raw;
      else if (Array.isArray(url.path)) path = url.path.join("/");
    }
    path = path.replace(/\{\{[^}]+\}\}/g, ":base").split("?")[0];
    const parameters: Record<string, { required: boolean }> = {};
    if (isRecord(url) && Array.isArray(url.query)) {
      for (const q of url.query) {
        if (isRecord(q) && typeof q.key === "string") {
          parameters[q.key] = { required: q.disabled !== true };
        }
      }
    }
    out[`${method} ${path}`] = {
      name: typeof item.name === "string" ? item.name : undefined,
      parameters,
    };
  }
}

function normalizePostman(parsed: Record<string, unknown>): NormalizedSpec {
  const endpoints: Record<string, unknown> = {};
  flattenPostmanItems(parsed.item, endpoints);
  const info = isRecord(parsed.info) ? parsed.info : {};
  const tree = {
    info: { name: typeof info.name === "string" ? info.name : undefined },
    endpoints,
  };
  return finish(
    tree,
    "postman",
    typeof info.version === "string" ? info.version : undefined,
    typeof info.name === "string" ? info.name : undefined,
  );
}

// ---------------------------------------------------------------------------
// Docs (HTML) and text/Markdown — section trees
// ---------------------------------------------------------------------------

function slugifyHeading(heading: string, index: number): string {
  const slug = heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || `section-${index}`;
}

function normalizeText(raw: string, kind: SourceKind = "text"): NormalizedSpec {
  const sections: Record<string, { heading: string; level: number; text: string }> = {};
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  let current = "introduction";
  let level = 1;
  let buffer: string[] = [];
  let index = 0;
  const flush = () => {
    const text = buffer.join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, MAX_SECTION_TEXT);
    if (text || index === 0) {
      sections[current] = { heading: current, level, text };
    }
    buffer = [];
  };
  for (const line of lines) {
    const md = line.match(/^(#{1,6})\s+(.+)$/);
    if (md) {
      flush();
      level = md[1].length;
      current = slugifyHeading(md[2], index++);
      sections[current] = { heading: md[2].trim(), level, text: "" };
    } else {
      buffer.push(line);
    }
  }
  flush();
  return finish({ sections }, kind);
}

function normalizeDocsHtml(raw: string): NormalizedSpec {
  const $ = cheerio.load(raw);
  $("script, style, nav, footer, header, noscript, svg").remove();
  const title = $("title").first().text().trim() || undefined;
  const sections: Record<string, { heading: string; level: number; text: string; code: string[] }> = {};
  const headings = $("h1, h2, h3").toArray();
  if (headings.length === 0) {
    const text = $("body").text().replace(/\s+/g, " ").trim().slice(0, MAX_SECTION_TEXT);
    sections["page"] = { heading: title ?? "page", level: 1, text, code: [] };
    return finish({ title, sections }, "docs", undefined, title);
  }
  headings.forEach((el, i) => {
    const heading = $(el).text().replace(/\s+/g, " ").trim();
    if (!heading) return;
    const level = Number(el.tagName.slice(1)) || 2;
    // Text until the next heading of same-or-higher level, approximated by
    // collecting following siblings' text within the parent — good enough for
    // a stable change signal without mirroring the vendor's DOM framework.
    const parts: string[] = [];
    const code: string[] = [];
    let node = $(el).next();
    let hops = 0;
    while (node.length && hops < 40) {
      const tag = (node.get(0)?.tagName ?? "").toLowerCase();
      if (/^h[123]$/.test(tag)) break;
      const t = node.text().replace(/\s+/g, " ").trim();
      if (t) parts.push(t);
      node.find("code, pre").each((_, c) => {
        const ct = $(c).text().trim().slice(0, 500);
        if (ct) code.push(ct);
      });
      node = node.next();
      hops++;
    }
    const slug = slugifyHeading(heading, i);
    sections[slug] = {
      heading,
      level,
      text: parts.join(" ").slice(0, MAX_SECTION_TEXT),
      code: code.slice(0, 10),
    };
  });
  return finish({ title, sections }, "docs", undefined, title);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export interface NormalizeOptions {
  /** Stored kind/format hint. Detection overrides it when unambiguous. */
  sourceKind?: SourceKind;
  specFormat?: string;
}

/**
 * Normalize any watchable document. Backwards compatible: OpenAPI input
 * produces exactly the tree the old OpenAPI-only normalizer produced.
 */
export async function normalizeSpec(raw: string, opts: NormalizeOptions = {}): Promise<NormalizedSpec> {
  const hint = opts.sourceKind ?? (opts.specFormat ? specFormatToSourceKind(opts.specFormat) : undefined);
  const kind = detectSourceKind(raw, hint);

  switch (kind) {
    case "openapi":
      return normalizeOpenApi(raw);
    case "graphql": {
      const parsed = tryParseStructured(raw);
      if (isRecord(parsed)) return normalizeGraphqlIntrospection(parsed);
      return normalizeGraphqlSdl(raw);
    }
    case "asyncapi": {
      const parsed = tryParseStructured(raw);
      if (!isRecord(parsed)) throw new Error("AsyncAPI document did not parse");
      const info = isRecord(parsed.info) ? parsed.info : {};
      return finish(
        stripVolatile(parsed),
        "asyncapi",
        typeof info.version === "string" ? info.version : undefined,
        typeof info.title === "string" ? info.title : undefined,
      );
    }
    case "postman": {
      const parsed = tryParseStructured(raw);
      if (!isRecord(parsed)) throw new Error("Postman collection did not parse");
      return normalizePostman(parsed);
    }
    case "docs":
      // A "docs" hint on a non-HTML body means a text/markdown docs page.
      if (/^\s*</.test(raw)) return normalizeDocsHtml(raw);
      return normalizeText(raw, "docs");
    case "json": {
      const parsed = tryParseStructured(raw);
      if (parsed === undefined) throw new Error("document did not parse as JSON/YAML");
      return finish(stripVolatile(parsed), "json");
    }
    case "text":
    default:
      return normalizeText(raw);
  }
}

/** Alias that reads better at universal-source call sites. */
export const normalizeDocument = normalizeSpec;
