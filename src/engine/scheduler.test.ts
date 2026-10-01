import { describe, it, expect, vi, beforeEach } from "vitest";
import type { EngineDeps, VendorConfig, PollOutcome, SnapshotMeta, ClassifiedChange, ChangelogEntry } from "./types";
import type { EngineStore, SnapshotStorage } from "./scheduler";
import { gzipSync } from "node:zlib";

// Create mock functions for each dependency
const mockFetchSpec = vi.fn();
const mockNormalizeSpec = vi.fn();
const mockDiffNormalizedSpecs = vi.fn();
const mockCreateChangelogSource = vi.fn();

// Mock all modules at the top level
vi.mock("./fetcher", () => ({
  fetchSpec: mockFetchSpec
}));
vi.mock("./normalizer", () => ({
  normalizeSpec: mockNormalizeSpec
}));
vi.mock("./differ", () => ({
  diffNormalizedSpecs: mockDiffNormalizedSpecs
}));
vi.mock("./changelog", () => ({
  createChangelogSource: mockCreateChangelogSource
}));

const mockVendor: VendorConfig = {
  id: "vendor-1",
  slug: "stripe",
  name: "Stripe",
  specUrl: "https://api.stripe.com/openapi.yaml",
  specFormat: "openapi3",
  changelog: { type: "none" },
  pollIntervalMinutes: 60,
  pollOffsetMinutes: 0,
  etag: '"abc123"',
  lastModified: "Wed, 01 Jan 2026 00:00:00 GMT",
  lastContentHash: "hash1",
};

const mockSnapshot: SnapshotMeta = {
  id: "snap-1",
  contentHash: "hash1",
  storagePath: "specs/stripe/hash1.json.gz",
  parseOk: true,
};

const mockChanges: ClassifiedChange[] = [
  {
    jsonPath: "paths./v1/charges.post.parameters[0]",
    kind: "param.added",
    severity: "breaking",
    summary: "Stripe added required parameter 'customer' to POST /v1/charges",
    impactHint: "If you create charges without a customer, the request will fail.",
  },
];

const mockEntries: ChangelogEntry[] = [
  {
    externalId: "changelog-1",
    title: "Added customer parameter to charges",
    url: "https://stripe.com/changelog/1",
    publishedAt: new Date(),
    content: "Details...",
  },
];

function createMockDeps(overrides: Partial<EngineDeps> = {}): EngineDeps {
  // Create mock storage and store with vi.fn() methods
  const mockStorage: SnapshotStorage = {
    put: vi.fn().mockResolvedValue(undefined),
    // Return gzipped data that when ungzipped gives us a spec
    get: vi.fn().mockResolvedValue(gzipSync(Buffer.from('{"openapi":"3.0.0","info":{"title":"Stripe","version":"2026-01-01"},"paths":{}}'))),
  };

  const mockStore: EngineStore = {
    claimDueVendors: vi.fn().mockResolvedValue([mockVendor]),
    getLatestSnapshot: vi.fn().mockResolvedValue(mockSnapshot),
    insertSnapshot: vi.fn().mockResolvedValue("snap-2"),
    insertChanges: vi.fn().mockResolvedValue(["change-1"]),
    insertChangelogEntries: vi.fn().mockResolvedValue(mockEntries),
    recordRun: vi.fn().mockResolvedValue(undefined),
    updateVendorState: vi.fn().mockResolvedValue(undefined),
    reserveLlmCalls: vi.fn().mockResolvedValue(1),
  };

  // Apply overrides if provided
  if (overrides.store) {
    Object.assign(mockStore, overrides.store);
  }
  if (overrides.storage) {
    Object.assign(mockStorage, overrides.storage);
  }

  // Create a mock classifier that uses fallback (no Groq API key needed)
  const mockClassifier = {
    async classifyBatch(vendorName: string, batch: any[], batchOffset: number) {
      const results = new Map<number, { summary: string; impactHint: string }>();
      batch.forEach((change, index) => {
        results.set(batchOffset + index, {
          summary: `${vendorName} changed ${change.jsonPath} (${change.kind}).`,
          impactHint:
            change.severity === "breaking"
              ? "If you use this part of the API, check your integration before your next deploy."
              : "No action required unless you rely on this part of the API.",
        });
      });
      return results;
    },
  };

  return {
    store: mockStore,
    storage: mockStorage,
    classifier: mockClassifier,
    onChanges: vi.fn().mockResolvedValue(undefined),
    now: () => new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("runTick", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("claims due vendors and ingests them", async () => {
    // Import the module after mocks are set up
    const { runTick } = await import("./scheduler");

    const deps = createMockDeps();

    // Set up mock implementations for this specific test
    mockFetchSpec.mockResolvedValue({
      raw: '{"openapi":"3.0.0","info":{"title":"Stripe","version":"2026-01-01"},"paths":{}}',
      changed: true,
      etag: '"new-etag"',
      lastModified: "Wed, 01 Jan 2026 00:00:00 GMT",
      sizeBytes: 500,
    });

    // normalizeSpec should be called twice:
    // 1. Once to normalize the new spec (from fetch)
    // 2. Once to normalize the previous spec (from storage for diffing)
    mockNormalizeSpec
      .mockResolvedValueOnce({
        tree: { openapi: "3.0.0", info: { title: "Stripe", version: "2026-01-01" }, paths: {} },
        hash: "newhash",
        specVersion: "2026-01-01",
      }) // First call: normalize the new spec
      .mockResolvedValueOnce({
        tree: { openapi: "3.0.0", info: { title: "Stripe", version: "2026-01-01" }, paths: {} },
        hash: "oldhash",
        specVersion: "2026-01-01",
      }); // Second call: normalize the previous spec

    // Since there IS a previous snapshot in our mock, diffNormalizedSpecs SHOULD be called
    // Since changelog type is "none", createChangelogSource should NOT be called
    mockDiffNormalizedSpecs.mockReturnValue(mockChanges);
    mockCreateChangelogSource.mockReturnValue({
      fetchLatest: vi.fn().mockResolvedValue([])
    });

    const outcomes = await runTick(deps, { limit: 3, tickBudgetMs: 240_000 });

    expect(deps.store.claimDueVendors).toHaveBeenCalledWith(
      new Date("2026-01-01T00:00:00Z"),
      3,
      5
    );
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0].vendorId).toBe("vendor-1");
    expect(outcomes[0].status).toBe("ok");

    // Verify the mocks were called as expected
    expect(mockFetchSpec).toHaveBeenCalled();
    // normalizeSpec should be called twice (once for new spec, once for old spec)
    expect(mockNormalizeSpec).toHaveBeenCalledTimes(2);
    // diffNormalizedSpecs SHOULD be called when there's a previous snapshot
    expect(mockDiffNormalizedSpecs).toHaveBeenCalled();
    // createChangelogSource should NOT be called when changelog.type is "none"
    expect(mockCreateChangelogSource).not.toHaveBeenCalled();
  });
});

describe("ingestVendor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns noop when spec hasn't changed", async () => {
    // Import the module after mocks are set up
    const { runTick } = await import("./scheduler");

    const deps = createMockDeps({
      store: {
        ...createMockDeps().store,
        getLatestSnapshot: vi.fn().mockResolvedValue({
          ...mockSnapshot,
          contentHash: "same-hash",
        }),
      },
    });

    // Set up mock implementations for this specific test
    mockFetchSpec.mockResolvedValue({
      raw: "{}",
      changed: false,
      etag: '"abc123"',
      lastModified: "Wed, 01 Jan 2026 00:00:00 GMT",
      sizeBytes: 100,
    });

    const outcomes = await runTick(deps, { limit: 1 });
    expect(outcomes[0].status).toBe("noop");
    expect(deps.store.recordRun).toHaveBeenCalledWith(
      "vendor-1",
      expect.any(Date),
      { status: "noop", changesFound: 0 }
    );

    // Verify the mock was called
    expect(mockFetchSpec).toHaveBeenCalled();
    // normalizeSpec should NOT be called when spec hasn't changed (early return)
    expect(mockNormalizeSpec).not.toHaveBeenCalled();
  });

  it("processes new spec and creates snapshot", async () => {
    // Import the module after mocks are set up
    const { ingestVendor } = await import("./scheduler");

    const deps = createMockDeps({
      store: {
        ...createMockDeps().store,
        getLatestSnapshot: vi.fn().mockResolvedValue(mockSnapshot),
      },
    });

    // Set up mock implementations for this specific test
    mockFetchSpec.mockResolvedValue({
      raw: '{"openapi":"3.0.0","info":{"title":"Stripe","version":"2026-01-01"},"paths":{}}',
      changed: true,
      etag: '"new-etag"',
      lastModified: "Wed, 01 Jan 2026 00:00:00 GMT",
      sizeBytes: 500,
    });

    // normalizeSpec should be called twice:
    // 1. Once to normalize the new spec (from fetch)
    // 2. Once to normalize the previous spec (from storage for diffing)
    mockNormalizeSpec
      .mockResolvedValueOnce({
        tree: { openapi: "3.0.0", info: { title: "Stripe", version: "2026-01-01" }, paths: {} },
        hash: "newhash",
        specVersion: "2026-01-01",
      }) // First call: normalize the new spec
      .mockResolvedValueOnce({
        tree: { openapi: "3.0.0", info: { title: "Stripe", version: "2026-01-01" }, paths: {} },
        hash: "oldhash",
        specVersion: "2026-01-01",
      }); // Second call: normalize the previous spec

    // Since there IS a previous snapshot in our mock, diffNormalizedSpecs SHOULD be called
    // Since changelog type is "none", createChangelogSource should NOT be called
    mockDiffNormalizedSpecs.mockReturnValue(mockChanges);
    mockCreateChangelogSource.mockReturnValue({
      fetchLatest: vi.fn().mockResolvedValue([])
    });

    const outcome = await ingestVendor(deps, mockVendor);

    expect(mockFetchSpec).toHaveBeenCalled();
    // normalizeSpec should be called twice (once for new spec, once for old spec)
    expect(mockNormalizeSpec).toHaveBeenCalledTimes(2);
    // diffNormalizedSpecs SHOULD be called when there's a previous snapshot
    expect(mockDiffNormalizedSpecs).toHaveBeenCalled();
    // createChangelogSource should NOT be called when changelog.type is "none"
    expect(mockCreateChangelogSource).not.toHaveBeenCalled();
    // Verify that storage and store methods were called
    expect(deps.storage.put).toHaveBeenCalled();
    expect(deps.store.insertSnapshot).toHaveBeenCalled();
    expect(deps.store.insertChanges).toHaveBeenCalled();
    expect(outcome.status).toBe("ok");
  });

  it("returns error when spec fetch fails", async () => {
    // Import the module after mocks are set up
    const { ingestVendor } = await import("./scheduler");

    const deps = createMockDeps();

    // Set up mock implementations for this specific test
    mockFetchSpec.mockRejectedValue(new Error("Network error"));

    const outcome = await ingestVendor(deps, mockVendor);

    expect(outcome.status).toBe("error");
    expect(outcome.error).toContain("Network error");

    // Verify the mock was called
    expect(mockFetchSpec).toHaveBeenCalled();
    // normalizeSpec should NOT be called when fetch fails (early return)
    expect(mockNormalizeSpec).not.toHaveBeenCalled();
  });
});