import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import { fetchSpec } from "./fetcher";
import { normalizeSpec } from "./normalizer";
import { diffNormalizedSpecs } from "./differ";
import {
  CHANGES_PER_LLM_CALL,
  createClassifier,
  fallbackSummaries,
  type Classifier,
} from "./classifier";
import { createChangelogSource } from "./changelog";
import type {
  ChangelogEntry,
  ClassifiedChange,
  PollOutcome,
  RawChange,
  SnapshotMeta,
  VendorConfig,
} from "./types";

export interface EngineStore {
  claimDueVendors(now: Date, limit: number, leaseMinutes: number): Promise<VendorConfig[]>;
  getLatestSnapshot(vendorId: string): Promise<SnapshotMeta | null>;
  insertSnapshot(
    vendorId: string,
    meta: {
      contentHash: string;
      sizeBytes: number;
      storagePath: string;
      specVersion?: string;
      parseOk: boolean;
    },
  ): Promise<string>;
  insertChanges(
    vendorId: string,
    fromSnapshotId: string | null,
    toSnapshotId: string,
    records: ClassifiedChange[],
  ): Promise<string[]>;
  insertChangelogEntries(vendorId: string, entries: ChangelogEntry[]): Promise<ChangelogEntry[]>;
  recordRun(
    vendorId: string,
    startedAt: Date,
    outcome: { status: PollOutcome["status"]; changesFound: number; error?: string },
  ): Promise<void>;
  updateVendorState(
    vendorId: string,
    patch: {
      etag?: string | null;
      lastModified?: string | null;
      lastContentHash?: string;
      nextPollAt?: Date;
      lastError?: string | null;
    },
  ): Promise<void>;
  /** Atomically reserve LLM calls within the per-vendor monthly cap; returns granted count. */
  reserveLlmCalls(vendorId: string, requested: number, monthlyCap: number): Promise<number>;
}

export interface SnapshotStorage {
  put(path: string, data: Buffer): Promise<void>;
  get(path: string): Promise<Buffer>;
}

export interface EngineDeps {
  store: EngineStore;
  storage: SnapshotStorage;
  classifier?: Classifier;
  onChanges?: (
    vendor: VendorConfig,
    changes: ClassifiedChange[],
    entries: ChangelogEntry[],
    changeIds: string[],
  ) => Promise<void>;
  now?: () => Date;
}

const CHANGELOG_FETCH_LIMIT = 20;
const ERROR_BACKOFF_MULTIPLIER = 4;

// supabase-js throws PostgREST errors as plain objects (not Error instances);
// String() on them is "[object Object]", so serialize with own properties.
function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err, Object.getOwnPropertyNames(err ?? {}));
  } catch {
    return String(err);
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function runTick(
  deps: EngineDeps,
  opts: { limit?: number; tickBudgetMs?: number } = {},
): Promise<PollOutcome[]> {
  const now = deps.now?.() ?? new Date();
  const limit = opts.limit ?? 3;
  const tickBudgetMs = opts.tickBudgetMs ?? 240_000;
  const startedAt = Date.now();

  const due = await deps.store.claimDueVendors(now, limit, 5);
  const outcomes: PollOutcome[] = [];

  for (const vendor of due) {
    if (Date.now() - startedAt > tickBudgetMs) {
      // leave vendor untouched: lease expires, next tick retries
      outcomes.push({ vendorId: vendor.id, slug: vendor.slug, status: "skipped", changesFound: 0 });
      continue;
    }
    outcomes.push(await ingestVendor(deps, vendor));
  }
  return outcomes;
}

export async function ingestVendor(
  deps: EngineDeps,
  vendor: VendorConfig,
): Promise<PollOutcome> {
  const runStartedAt = new Date();
  const now = () => deps.now?.() ?? new Date();
  const scheduleNext = () =>
    new Date(now().getTime() + vendor.pollIntervalMinutes * 60_000);

  const fail = async (error: string, changesFound = 0): Promise<PollOutcome> => {
    await deps.store.recordRun(vendor.id, runStartedAt, {
      status: "error",
      changesFound,
      error: error.slice(0, 500),
    });
    await deps.store.updateVendorState(vendor.id, {
      nextPollAt: new Date(
        now().getTime() + vendor.pollIntervalMinutes * 60_000 * ERROR_BACKOFF_MULTIPLIER,
      ),
      lastError: error.slice(0, 500),
    });
    return { vendorId: vendor.id, slug: vendor.slug, status: "error", changesFound, error };
  };

  try {
    // --- changelog first: new entries can exist without a spec change ---
    let newEntries: ChangelogEntry[] = [];
    if (vendor.changelog.type !== "none" && vendor.changelog.url) {
      try {
        const source = createChangelogSource(vendor.changelog);
        const entries = await source.fetchLatest(CHANGELOG_FETCH_LIMIT);
        newEntries = await deps.store.insertChangelogEntries(vendor.id, entries);
      } catch {
        // changelog failures never fail the spec poll
        newEntries = [];
      }
    }

    // --- conditional spec fetch ---
    const spec = await fetchSpec(vendor.specUrl, {
      etag: vendor.etag,
      lastModified: vendor.lastModified,
    });

    if (!spec.changed) {
      await deps.store.recordRun(vendor.id, runStartedAt, { status: "noop", changesFound: 0 });
      await deps.store.updateVendorState(vendor.id, { nextPollAt: scheduleNext() });
      if (newEntries.length > 0) await deps.onChanges?.(vendor, [], newEntries, []);
      return { vendorId: vendor.id, slug: vendor.slug, status: "noop", changesFound: 0 };
    }

    const contentHash = createHash("sha256").update(spec.raw).digest("hex");
    if (contentHash === vendor.lastContentHash) {
      await deps.store.recordRun(vendor.id, runStartedAt, { status: "noop", changesFound: 0 });
      await deps.store.updateVendorState(vendor.id, { nextPollAt: scheduleNext() });
      if (newEntries.length > 0) await deps.onChanges?.(vendor, [], newEntries, []);
      return { vendorId: vendor.id, slug: vendor.slug, status: "noop", changesFound: 0 };
    }

    // --- persist raw snapshot (audit trail), gzip to storage ---
    const storagePath = `specs/${vendor.slug}/${contentHash}.json.gz`;
    await deps.storage.put(storagePath, gzipSync(Buffer.from(spec.raw, "utf8")));

    // --- normalize; parse failures are recorded but don't crash-loop ---
    let normalized: Awaited<ReturnType<typeof normalizeSpec>>;
    try {
      normalized = await normalizeSpec(spec.raw);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await deps.store.insertSnapshot(vendor.id, {
        contentHash,
        sizeBytes: spec.sizeBytes,
        storagePath,
        parseOk: false,
      });
      await deps.store.recordRun(vendor.id, runStartedAt, {
        status: "error",
        changesFound: 0,
        error: `parse: ${message}`.slice(0, 500),
      });
      await deps.store.updateVendorState(vendor.id, {
        etag: spec.etag ?? null,
        lastModified: spec.lastModified ?? null,
        lastContentHash: contentHash,
        nextPollAt: scheduleNext(),
        lastError: `parse: ${message}`.slice(0, 500),
      });
      return {
        vendorId: vendor.id,
        slug: vendor.slug,
        status: "error",
        changesFound: 0,
        error: `parse: ${message}`,
      };
    }

    // --- previous snapshot, fetched BEFORE inserting the new one ---
    const prev = await deps.store.getLatestSnapshot(vendor.id);

    const toSnapshotId = await deps.store.insertSnapshot(vendor.id, {
      contentHash,
      sizeBytes: spec.sizeBytes,
      storagePath,
      specVersion: normalized.specVersion,
      parseOk: true,
    });
    let rawChanges: RawChange[] = [];
    let fromSnapshotId: string | null = null;

    if (prev && prev.parseOk) {
      try {
        const prevRaw = gunzipSync(await deps.storage.get(prev.storagePath)).toString("utf8");
        const prevNormalized = await normalizeSpec(prevRaw);
        fromSnapshotId = prev.id;
        rawChanges = diffNormalizedSpecs(prevNormalized.tree, normalized.tree);
      } catch {
        // cannot rebuild previous tree: record the snapshot, skip diffing this round
        rawChanges = [];
      }
    }

    // --- LLM prose within the monthly budget, template fallback for the rest ---
    const batches = chunk(rawChanges, CHANGES_PER_LLM_CALL);
    const classifier = deps.classifier ?? createClassifier();
    const grantedBatches =
      batches.length > 0 && deps.classifier
        ? await deps.store.reserveLlmCalls(vendor.id, batches.length, 40)
        : 0;

    const summaries = new Map<number, { summary: string; impactHint: string }>();
    for (let i = 0; i < batches.length; i++) {
      if (i < grantedBatches) {
        try {
          const result = await classifier.classifyBatch(
            vendor.name,
            batches[i],
            i * CHANGES_PER_LLM_CALL,
          );
          for (const [index, value] of result) summaries.set(index, value);
        } catch (err) {
          console.error("[classifier] batch failed, using fallback:", err);
          const fallback = fallbackSummaries(vendor.name, batches[i]);
          for (const [index, value] of fallback) summaries.set(index, value);
        }
      } else {
        const fallback = fallbackSummaries(vendor.name, batches[i]);
        for (const [index, value] of fallback) summaries.set(index, value);
      }
    }

    const classified: ClassifiedChange[] = rawChanges.map((change, index) => ({
      ...change,
      summary: summaries.get(index)?.summary,
      impactHint: summaries.get(index)?.impactHint,
    }));

    let changeIds: string[] = [];
    if (classified.length > 0) {
      changeIds = await deps.store.insertChanges(
        vendor.id,
        fromSnapshotId,
        toSnapshotId,
        classified,
      );
    }

    await deps.store.recordRun(vendor.id, runStartedAt, {
      status: "ok",
      changesFound: classified.length,
    });
    await deps.store.updateVendorState(vendor.id, {
      etag: spec.etag ?? null,
      lastModified: spec.lastModified ?? null,
      lastContentHash: contentHash,
      nextPollAt: scheduleNext(),
      lastError: null,
    });

    if (classified.length > 0 || newEntries.length > 0) {
      await deps.onChanges?.(vendor, classified, newEntries, changeIds);
    }

    return {
      vendorId: vendor.id,
      slug: vendor.slug,
      status: "ok",
      changesFound: classified.length,
    };
  } catch (err) {
    return fail(describeError(err));
  }
}

export type { Classifier };
