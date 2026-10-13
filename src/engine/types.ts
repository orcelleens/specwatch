export type Severity = "breaking" | "feature" | "deprecation" | "docs";

/**
 * The kind of source SpecWatch watches. This is the universalisation of the
 * old `SpecFormat` ("openapi3" | "swagger2" only): any API that publishes
 * *something* machine- or human-readable can be watched.
 *
 * - `openapi`  — OpenAPI 3.x or Swagger 2.0 document (JSON or YAML)
 * - `graphql`  — GraphQL SDL file or introspection JSON (`{__schema}` / `{data:{__schema}}`)
 * - `asyncapi` — AsyncAPI document (JSON or YAML)
 * - `postman`  — Postman Collection v2.x JSON
 * - `docs`     — an HTML documentation page (structured section diff)
 * - `json`     — any other JSON/YAML document (canonical generic diff)
 * - `text`     — any plain-text / Markdown document (section diff)
 *
 * Detection is authoritative (see `detectSourceKind` in ./normalizer): the
 * stored kind is only a hint for ambiguous documents.
 */
export type SourceKind =
  | "openapi"
  | "graphql"
  | "asyncapi"
  | "postman"
  | "docs"
  | "json"
  | "text";

/** Legacy spec formats, kept for backwards compat with existing rows/code. */
export type SpecFormat =
  | "openapi3"
  | "swagger2"
  | "openapi"
  | "graphql"
  | "asyncapi"
  | "postman"
  | "docs"
  | "json"
  | "text";

/** Map a stored/legacy format value to a SourceKind hint. */
export function specFormatToSourceKind(format: string | undefined | null): SourceKind {
  switch (format) {
    case "graphql":
    case "asyncapi":
    case "postman":
    case "docs":
    case "json":
    case "text":
      return format;
    default:
      // openapi3 / swagger2 / openapi / unknown → openapi (detection may override)
      return "openapi";
  }
}

export interface ChangelogConfig {
  /**
   * - `rss`              — any RSS/Atom feed
   * - `html`             — scrape a changelog page with CSS selectors
   * - `github-releases`  — GitHub Releases API; `url` is `owner/repo` or a repo URL
   * - `none`             — no changelog source
   */
  type: "rss" | "html" | "github-releases" | "none";
  url?: string;
  selectors?: {
    item?: string;
    title?: string;
    link?: string;
    date?: string;
    content?: string;
  };
}

export interface VendorConfig {
  id: string;
  slug: string;
  name: string;
  /** Canonical watched URL: a spec file, a docs page, a schema — whatever is watched. */
  specUrl: string;
  /** Legacy format column. Kept in sync with `sourceKind`; detection is authoritative. */
  specFormat: SpecFormat;
  /** What kind of source `specUrl` is. Optional hint — detection may override it. */
  sourceKind?: SourceKind;
  /** `public` = shared catalog vendor; `private` = a user's own custom API. */
  visibility?: "public" | "private";
  /** Clerk user id that owns a private vendor. */
  ownerUserId?: string | null;
  changelog: ChangelogConfig;
  pollIntervalMinutes: number;
  pollOffsetMinutes: number;
  etag?: string | null;
  lastModified?: string | null;
  lastContentHash?: string | null;
}

export interface FetchedSpec {
  raw: string;
  changed: boolean;
  etag?: string;
  lastModified?: string;
  sizeBytes: number;
}

export interface NormalizedSpec {
  tree: unknown;
  hash: string;
  specVersion?: string;
  /** The source kind that was actually detected/normalized. */
  detectedKind: SourceKind;
  /** Human title of the document, when one could be read. */
  title?: string;
}

export interface RawChange {
  jsonPath: string;
  kind: string;
  severity: Severity;
  before?: unknown;
  after?: unknown;
}

export interface ChangeGroup {
  changes: RawChange[];
  severity: Severity;
  coalescedPath: string;
}

export interface ClassifiedChange {
  jsonPath: string;
  kind: string;
  severity: Severity;
  before?: unknown;
  after?: unknown;
  summary?: string;
  impactHint?: string;
}

export interface ChangelogEntry {
  externalId: string;
  title: string;
  url?: string;
  publishedAt: Date;
  content?: string;
}

export interface SnapshotMeta {
  id: string;
  contentHash: string;
  storagePath: string;
  parseOk: boolean;
}

export interface PollOutcome {
  vendorId: string;
  slug: string;
  status: "ok" | "noop" | "error" | "skipped";
  changesFound: number;
  error?: string;
}

export const SEVERITY_RANK: Record<Severity, number> = {
  breaking: 0,
  deprecation: 1,
  feature: 2,
  docs: 3,
};

export function maxSeverity(a: Severity, b: Severity): Severity {
  return SEVERITY_RANK[a] <= SEVERITY_RANK[b] ? a : b;
}

export type { TreeDiff } from "./differ";
export type { EngineDeps } from "./scheduler";
