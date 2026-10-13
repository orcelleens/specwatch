import { fetchSpec } from "./fetcher";
import { detectSourceKind, normalizeSpec } from "./normalizer";
import type { SourceKind } from "./types";

/**
 * Source probe & discovery.
 *
 * This is what makes SpecWatch work for "any API from Supabase to very
 * niche": a user pastes *any* URL — a spec file, a docs page, or just a
 * homepage — and SpecWatch figures out what can be watched:
 *
 *  1. The URL itself is fetched and its format detected.
 *  2. If it is only a landing/docs page, well-known spec locations are
 *     probed (`/openapi.json`, `/swagger.json`, `/api-docs`, …).
 *  3. The guaranteed fallback is watching the docs page itself: a
 *     section-level diff of the documentation is a weaker signal than a
 *     spec diff, but it is never *no* signal.
 *
 * Everything here is pure/DI-friendly: `fetchBody` is injectable so tests
 * never touch the network.
 */

export type FetchBody = (url: string) => Promise<string>;

export const defaultFetchBody: FetchBody = async (url) => {
  const res = await fetchSpec(url, {});
  return res.raw;
};

export interface ProbeResult {
  url: string;
  ok: boolean;
  kind: SourceKind | null;
  /** Human title read from the document, when available. */
  title?: string;
  /** Rough surface size: endpoints / types / sections / top-level keys. */
  surfaceCount?: number;
  error?: string;
}

function countSurface(tree: unknown, kind: SourceKind): number | undefined {
  if (!tree || typeof tree !== "object") return undefined;
  const t = tree as Record<string, unknown>;
  const countKeys = (v: unknown) => (v && typeof v === "object" ? Object.keys(v as object).length : 0);
  switch (kind) {
    case "openapi":
      return countKeys(t.paths);
    case "graphql":
      return countKeys(t.types);
    case "asyncapi":
      return countKeys(t.channels) + countKeys(t.operations);
    case "postman":
      return countKeys(t.endpoints);
    case "docs":
    case "text":
      return countKeys(t.sections);
    default:
      return Object.keys(t).length;
  }
}

/** Probe a body we already have (no fetch). Verifies it actually normalizes. */
export async function probeBody(url: string, body: string): Promise<ProbeResult> {
  const kind = detectSourceKind(body);
  try {
    const normalized = await normalizeSpec(body);
    return {
      url,
      ok: true,
      kind: normalized.detectedKind ?? kind,
      title: normalized.title,
      surfaceCount: countSurface(normalized.tree, normalized.detectedKind),
    };
  } catch (err) {
    return {
      url,
      ok: false,
      kind,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Fetch one URL and probe what came back. Never throws. */
export async function probeUrl(url: string, fetchBody: FetchBody = defaultFetchBody): Promise<ProbeResult> {
  try {
    const body = await fetchBody(url);
    return await probeBody(url, body);
  } catch (err) {
    return {
      url,
      ok: false,
      kind: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Well-known spec locations to try when given a homepage/docs URL. */
export function candidateSourceUrls(input: string): string[] {
  let base: URL;
  try {
    base = new URL(input);
  } catch {
    return [];
  }
  const origin = base.origin;
  const paths = [
    "/openapi.json",
    "/openapi.yaml",
    "/swagger.json",
    "/swagger.yaml",
    "/api/openapi.json",
    "/api-docs",
    "/v1/openapi.json",
    "/docs/openapi.json",
    "/schema.graphql",
    "/graphql/schema.graphql",
    "/asyncapi.json",
    "/asyncapi.yaml",
  ];
  return paths.map((p) => `${origin}${p}`).filter((u) => u !== input);
}

const STRUCTURED: ReadonlySet<SourceKind> = new Set(["openapi", "graphql", "asyncapi", "postman", "json"]);

export interface DiscoveryResult {
  /** The URL to watch. */
  url: string;
  kind: SourceKind;
  title?: string;
  surfaceCount?: number;
  /** Every URL that was probed, in order (for transparency/debugging). */
  probed: ProbeResult[];
}

/**
 * Given any URL, find the best watchable source for it. Preference order:
 * the URL itself when structured → a discovered structured spec → the URL
 * itself as docs/text. Returns null only when nothing could be fetched.
 */
export async function discoverSource(
  input: string,
  fetchBody: FetchBody = defaultFetchBody,
): Promise<DiscoveryResult | null> {
  const probed: ProbeResult[] = [];

  const first = await probeUrl(input, fetchBody);
  probed.push(first);
  if (first.ok && first.kind && STRUCTURED.has(first.kind)) {
    return { url: input, kind: first.kind, title: first.title, surfaceCount: first.surfaceCount, probed };
  }

  for (const candidate of candidateSourceUrls(input)) {
    const result = await probeUrl(candidate, fetchBody);
    probed.push(result);
    if (result.ok && result.kind && STRUCTURED.has(result.kind)) {
      return { url: candidate, kind: result.kind, title: result.title, surfaceCount: result.surfaceCount, probed };
    }
  }

  // Guaranteed fallback: watch the page we were given.
  if (first.ok && first.kind) {
    return { url: input, kind: first.kind, title: first.title, surfaceCount: first.surfaceCount, probed };
  }
  return null;
}
