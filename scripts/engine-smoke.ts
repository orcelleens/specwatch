/**
 * Engine smoke test — no external services required.
 * Runs the full poll → normalize → snapshot → diff → classify → notify pipeline
 * against an in-memory store, plus a real-spec normalization leg (network).
 *
 * Usage: npx tsx scripts/engine-smoke.ts
 */
import { runTick, type EngineDeps, type EngineStore, type SnapshotStorage } from "../src/engine/scheduler";
import type {
  ChangelogEntry,
  ClassifiedChange,
  PollOutcome,
  SnapshotMeta,
  VendorConfig,
} from "../src/engine/types";
import { normalizeSpec } from "../src/engine/normalizer";
import { diffNormalizedSpecs } from "../src/engine/differ";
import { fetchSpec } from "../src/engine/fetcher";

let failures = 0;
function assert(condition: unknown, label: string): void {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}`);
  }
}

// ---------- in-memory EngineStore ----------

interface VendorState {
  nextPollAt: Date;
  leaseUntil?: Date;
  etag?: string | null;
  lastModified?: string | null;
  lastContentHash?: string | null;
  lastError?: string | null;
}

class MemoryStore implements EngineStore {
  vendors = new Map<string, VendorConfig>();
  states = new Map<string, VendorState>();
  snapshots = new Map<string, SnapshotMeta[]>();
  changeLog: { vendorId: string; records: ClassifiedChange[] }[] = [];
  knownEntries = new Map<string, Set<string>>();
  runs: { vendorId: string; status: string }[] = [];
  private seq = 0;

  async claimDueVendors(now: Date, limit: number, leaseMinutes: number): Promise<VendorConfig[]> {
    const claimed: VendorConfig[] = [];
    for (const [id, vendor] of this.vendors) {
      if (claimed.length >= limit) break;
      const state = this.states.get(id)!;
      if (state.nextPollAt > now) continue;
      if (state.leaseUntil && state.leaseUntil > now) continue;
      state.leaseUntil = new Date(now.getTime() + leaseMinutes * 60_000);
      claimed.push({
        ...vendor,
        etag: state.etag,
        lastModified: state.lastModified,
        lastContentHash: state.lastContentHash,
      });
    }
    return claimed;
  }

  async getLatestSnapshot(vendorId: string): Promise<SnapshotMeta | null> {
    const list = this.snapshots.get(vendorId) ?? [];
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].parseOk) return list[i];
    }
    return null;
  }

  async insertSnapshot(
    vendorId: string,
    meta: { contentHash: string; sizeBytes: number; storagePath: string; specVersion?: string; parseOk: boolean },
  ): Promise<string> {
    const id = `snap-${++this.seq}`;
    const list = this.snapshots.get(vendorId) ?? [];
    list.push({ id, contentHash: meta.contentHash, storagePath: meta.storagePath, parseOk: meta.parseOk });
    this.snapshots.set(vendorId, list);
    return id;
  }

  async insertChanges(
    vendorId: string,
    _from: string | null,
    _to: string,
    records: ClassifiedChange[],
  ): Promise<string[]> {
    this.changeLog.push({ vendorId, records });
    return records.map((_, i) => `chg-${++this.seq}-${i}`);
  }

  async insertChangelogEntries(vendorId: string, entries: ChangelogEntry[]): Promise<ChangelogEntry[]> {
    const known = this.knownEntries.get(vendorId) ?? new Set<string>();
    const fresh = entries.filter((e) => !known.has(e.externalId));
    for (const e of fresh) known.add(e.externalId);
    this.knownEntries.set(vendorId, known);
    return fresh;
  }

  async recordRun(
    vendorId: string,
    _startedAt: Date,
    outcome: { status: PollOutcome["status"] },
  ): Promise<void> {
    this.runs.push({ vendorId, status: outcome.status });
  }

  async updateVendorState(
    vendorId: string,
    patch: { etag?: string | null; lastModified?: string | null; lastContentHash?: string; nextPollAt?: Date; lastError?: string | null },
  ): Promise<void> {
    const state = this.states.get(vendorId)!;
    if (patch.etag !== undefined) state.etag = patch.etag;
    if (patch.lastModified !== undefined) state.lastModified = patch.lastModified;
    if (patch.lastContentHash !== undefined) state.lastContentHash = patch.lastContentHash;
    if (patch.nextPollAt !== undefined) state.nextPollAt = patch.nextPollAt;
    if (patch.lastError !== undefined) state.lastError = patch.lastError;
  }

  async reserveLlmCalls(): Promise<number> {
    return 0;
  }
}

class MemoryStorage implements SnapshotStorage {
  objects = new Map<string, Buffer>();
  async put(path: string, data: Buffer): Promise<void> {
    this.objects.set(path, data);
  }
  async get(path: string): Promise<Buffer> {
    const buf = this.objects.get(path);
    if (!buf) throw new Error(`missing object ${path}`);
    return buf;
  }
}

// ---------- fixture specs ----------

const RESPONSES = { "200": { description: "ok" } } as const;

function specV1() {
  return {
    openapi: "3.0.0",
    info: { title: "Smoke Pay", version: "1.0.0", description: "fixture" },
    paths: {
      "/v1/charges": {
        post: {
          summary: "Create a charge",
          deprecated: false,
          parameters: [
            { name: "amount", in: "query", required: true, schema: { type: "integer" } },
            { name: "metadata", in: "query", required: false, schema: { type: "object" } },
          ],
          responses: RESPONSES,
        },
      },
      "/v1/refunds": {
        get: { summary: "List refunds", deprecated: false, responses: RESPONSES },
      },
    },
    components: {
      schemas: {
        Charge: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", description: "Charge id" },
            amount: { type: "integer" },
          },
        },
      },
    },
  };
}

function specV2(): ReturnType<typeof specV1> {
  const spec = specV1();
  spec.info.version = "2.0.0";
  const post = (spec.paths as Record<string, unknown>)["/v1/charges"] as {
    post: { parameters: unknown[] };
  };
  // parameter removed -> breaking
  post.post.parameters = post.post.parameters.filter((p) => (p as { name: string }).name !== "metadata");
  // deprecated flipped -> deprecation
  const refunds = (spec.paths as Record<string, unknown>)["/v1/refunds"] as {
    get: { deprecated: boolean };
  };
  refunds.get.deprecated = true;
  const charge = ((spec.components as { schemas: Record<string, unknown> }).schemas.Charge as {
    properties: Record<string, { type: string; description?: string }>;
  }).properties;
  // description-only edit -> docs
  charge.id.description = "The charge identifier";
  // new optional property -> feature
  charge.risk_score = { type: "number" };
  // whole new endpoint -> feature
  (spec.paths as Record<string, unknown>)["/v1/payouts"] = {
    get: { summary: "List payouts", responses: RESPONSES },
  };
  return spec;
}

function dataUrl(obj: unknown): string {
  return `data:application/json,${encodeURIComponent(JSON.stringify(obj))}`;
}

// ---------- pipeline test ----------

async function main() {
  console.log("engine smoke test");

  const store = new MemoryStore();
  const storage = new MemoryStorage();
  let clockMs = Date.parse("2026-09-23T10:00:00Z");
  const deps: EngineDeps = {
    store,
    storage,
    now: () => new Date(clockMs),
  };

  const notified: { slug: string; changes: ClassifiedChange[]; ids: string[] }[] = [];
  deps.onChanges = async (vendor, changes, _entries, ids) => {
    notified.push({ slug: vendor.slug, changes, ids });
  };

  const vendor: VendorConfig = {
    id: "v-smoke",
    slug: "smokepay",
    name: "Smoke Pay",
    specUrl: dataUrl(specV1()),
    specFormat: "openapi3",
    changelog: { type: "none" },
    pollIntervalMinutes: 60,
    pollOffsetMinutes: 0,
  };
  store.vendors.set(vendor.id, vendor);
  store.states.set(vendor.id, { nextPollAt: new Date(clockMs - 1) });

  console.log("\n[1] baseline tick");
  let outcomes = await runTick(deps, { limit: 3 });
  assert(outcomes.length === 1 && outcomes[0].status === "ok", "tick 1 ok");
  assert(outcomes[0].changesFound === 0, "baseline has zero changes");
  assert((store.snapshots.get("v-smoke") ?? []).length === 1, "baseline snapshot stored");
  assert(storage.objects.size === 1, "snapshot gzipped to storage");
  assert(notified.length === 0, "no notifications on baseline");

  console.log("\n[2] vendor publishes v2 (param removed, deprecated flip, docs edit, new property, new endpoint)");
  clockMs += 61 * 60_000;
  vendor.specUrl = dataUrl(specV2());
  outcomes = await runTick(deps, { limit: 3 });
  assert(outcomes.length === 1 && outcomes[0].status === "ok", "tick 2 ok");
  const found = outcomes[0].changesFound;
  assert(found >= 4, `detected ${found} changes (expected >= 4: breaking/deprecation/feature/docs)`);

  const severities = new Set(notified[0]?.changes.map((c) => c.severity) ?? []);
  assert(severities.has("breaking"), "breaking change flagged");
  assert(severities.has("deprecation"), "deprecation flagged");
  assert(severities.has("feature"), "new surface flagged as feature");
  assert(severities.has("docs"), "description edit classified as docs");
  const breaking = (notified[0]?.changes ?? []).find((c) => c.severity === "breaking");
  assert(!!breaking, "breaking change present in notification payload");
  assert(notified[0]?.ids.length === found, "change ids handed to notifier");
  assert(
    (store.snapshots.get("v-smoke") ?? []).length === 2,
    "second snapshot stored, first kept",
  );
  for (const c of notified[0]?.changes ?? []) {
    assert(!!c.summary, `summary present for ${c.kind}`);
    console.log(
      `         - [${c.severity}] ${c.kind} @ ${c.jsonPath}${c.impactHint ? ` — ${c.impactHint}` : ""}`,
    );
  }

  console.log("\n[3] unchanged spec -> conditional noop");
  clockMs += 61 * 60_000;
  outcomes = await runTick(deps, { limit: 3 });
  assert(outcomes[0].status === "noop", "tick 3 noop");
  assert(outcomes[0].changesFound === 0, "no changes on noop");
  assert((store.snapshots.get("v-smoke") ?? []).length === 2, "noop stored no new snapshot");

  console.log("\n[4] real-world spec leg: Square api.json");
  try {
    const real = await fetchSpec(
      "https://raw.githubusercontent.com/square/connect-api-specification/master/api.json",
      {},
    );
    assert(real.sizeBytes > 100_000, `fetched ${real.sizeBytes} bytes`);
    const normalized = await normalizeSpec(real.raw);
    assert(normalized.hash.length === 64, `normalized, sha256 ${normalized.hash.slice(0, 12)}…`);
    const selfDiff = diffNormalizedSpecs(normalized.tree, normalized.tree);
    assert(selfDiff.length === 0, "self-diff is empty");
    const mutated = JSON.parse(real.raw) as Record<string, unknown>;
    const paths = mutated.paths as Record<string, unknown>;
    const firstPath = Object.keys(paths)[0];
    delete paths[firstPath];
    const mutatedNormalized = await normalizeSpec(JSON.stringify(mutated));
    const realChanges = diffNormalizedSpecs(normalized.tree, mutatedNormalized.tree);
    assert(
      realChanges.some((c) => c.severity === "breaking"),
      `real spec mutation detected (${realChanges.length} changes, breaking present)`,
    );
    console.log(`         - removed ${firstPath} -> breaking detected in real Square spec`);
  } catch (err) {
    failures++;
    console.log(`  FAIL real-spec leg: ${err instanceof Error ? err.message : err}`);
  }

  console.log("\n[5] seed sweep: fetch + normalize all 9 seed vendor specs");
  const SEEDS: [string, string][] = [
    ["stripe", "https://raw.githubusercontent.com/stripe/openapi/master/latest/openapi.spec3.yaml"],
    ["github", "https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json"],
    ["openai", "https://raw.githubusercontent.com/openai/openai-openapi/master/openapi.yaml"],
    ["twilio", "https://raw.githubusercontent.com/twilio/twilio-oai/main/spec/json/twilio_api_v2010.json"],
    ["slack", "https://raw.githubusercontent.com/slackapi/slack-api-specs/master/web-api/slack_web_openapi_v2.json"],
    ["supabase", "https://api.supabase.com/api/v1-json"],
    ["cloudflare", "https://raw.githubusercontent.com/cloudflare/api-schemas/main/openapi.json"],
    ["square", "https://raw.githubusercontent.com/square/connect-api-specification/master/api.json"],
    ["plaid", "https://raw.githubusercontent.com/plaid/plaid-openapi/master/2020-09-14.yml"],
  ];
  for (const [name, url] of SEEDS) {
    try {
      const spec = await fetchSpec(url, {});
      const normalized = await normalizeSpec(spec.raw);
      assert(
        normalized.hash.length === 64,
        `${name}: fetched ${(spec.sizeBytes / 1024).toFixed(0)}KB, normalized (v${normalized.specVersion ?? "?"})`,
      );
    } catch (err) {
      failures++;
      console.log(`  FAIL ${name}: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
