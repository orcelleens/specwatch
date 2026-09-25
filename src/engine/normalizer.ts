import { createHash } from "node:crypto";
import SwaggerParser from "@apidevtools/swagger-parser";
import YAML from "yaml";
import type { OpenAPI } from "openapi-types";
import type { NormalizedSpec } from "./types";

const VOLATILE_KEYS = new Set(["examples", "example", "externalDocs"]);
const MAX_TREE_BYTES = 40 * 1024 * 1024;

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

export async function normalizeSpec(raw: string): Promise<NormalizedSpec> {
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
  const serialized = stableStringify(tree);
  if (Buffer.byteLength(serialized, "utf8") > MAX_TREE_BYTES) {
    throw new Error(`normalized tree exceeds ${MAX_TREE_BYTES} bytes`);
  }
  return {
    tree,
    hash: createHash("sha256").update(serialized).digest("hex"),
    specVersion: bundled.info?.version ?? undefined,
  };
}
