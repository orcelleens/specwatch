export type Severity = "breaking" | "feature" | "deprecation" | "docs";

export type SpecFormat = "openapi3" | "swagger2";

export interface ChangelogConfig {
  type: "rss" | "html" | "none";
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
  specUrl: string;
  specFormat: SpecFormat;
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
