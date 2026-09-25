import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ChangelogEntry,
  ClassifiedChange,
  PollOutcome,
  SnapshotMeta,
  VendorConfig,
} from "@/engine/types";
import type { EngineStore } from "@/engine/scheduler";

interface VendorRow {
  id: string;
  slug: string;
  name: string;
  spec_url: string;
  spec_format: "openapi3" | "swagger2";
  changelog: VendorConfig["changelog"];
  poll_interval_minutes: number;
  poll_offset_minutes: number;
  etag: string | null;
  last_modified: string | null;
  last_content_hash: string | null;
}

interface SnapshotRow {
  id: string;
  content_hash: string;
  storage_path: string;
  parse_ok: boolean;
}

// Postgres text rejects NUL and most C0 control bytes (error 22P05). Error
// messages can carry raw binary (e.g. an undecoded gzip body), which would
// crash the very write that records the failure.
function sanitizeText(value: string | null | undefined): string | null | undefined {
  if (value == null) return value;
  let out = "";
  for (const ch of value) {
    const cp = ch.codePointAt(0) ?? 0;
    // keep tab (9), LF (10), CR (13); drop other C0 controls incl. NUL
    if (cp < 32 && cp !== 9 && cp !== 10 && cp !== 13) continue;
    out += ch;
  }
  return out;
}

export class SupabaseStore implements EngineStore {
  constructor(private db: SupabaseClient) {}

  async claimDueVendors(now: Date, limit: number, leaseMinutes: number): Promise<VendorConfig[]> {
    const { data, error } = await this.db.rpc("claim_due_vendors", {
      p_limit: limit,
      p_monthly_lease_minutes: leaseMinutes,
    });
    if (error) throw error;
    return (data as VendorRow[]).map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      specUrl: row.spec_url,
      specFormat: row.spec_format,
      changelog: row.changelog,
      pollIntervalMinutes: row.poll_interval_minutes,
      pollOffsetMinutes: row.poll_offset_minutes,
      etag: row.etag,
      lastModified: row.last_modified,
      lastContentHash: row.last_content_hash,
    }));
  }

  async getLatestSnapshot(vendorId: string): Promise<SnapshotMeta | null> {
    const { data, error } = await this.db
      .from("spec_snapshots")
      .select("id, content_hash, storage_path, parse_ok")
      .eq("vendor_id", vendorId)
      .eq("parse_ok", true)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const row = data as SnapshotRow;
    return {
      id: row.id,
      contentHash: row.content_hash,
      storagePath: row.storage_path,
      parseOk: row.parse_ok,
    };
  }

  async insertSnapshot(
    vendorId: string,
    meta: {
      contentHash: string;
      sizeBytes: number;
      storagePath: string;
      specVersion?: string;
      parseOk: boolean;
    },
  ): Promise<string> {
    const { data, error } = await this.db
      .from("spec_snapshots")
      // a vendor can republish previously-seen content (revert, re-upload):
      // (vendor_id, content_hash) is unique, so reuse the existing row as
      // the diff target instead of crashing the ingest with 23505.
      .upsert(
        {
          vendor_id: vendorId,
          content_hash: meta.contentHash,
          size_bytes: meta.sizeBytes,
          storage_path: meta.storagePath,
          spec_version: meta.specVersion,
          parse_ok: meta.parseOk,
          // stamp on conflict too, so republished content becomes "latest"
          // (getLatestSnapshot orders by fetched_at)
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "vendor_id,content_hash" },
      )
      .select("id")
      .single();
    if (error) throw error;
    return (data as { id: string }).id;
  }

  async insertChanges(
    vendorId: string,
    fromSnapshotId: string | null,
    toSnapshotId: string,
    records: ClassifiedChange[],
  ): Promise<string[]> {
    const { data, error } = await this.db
      .from("changes")
      .insert(
        records.map((record) => ({
          vendor_id: vendorId,
          from_snapshot_id: fromSnapshotId,
          to_snapshot_id: toSnapshotId,
          json_path: record.jsonPath,
          kind: record.kind,
          severity: record.severity,
          summary: record.summary,
          impact_hint: record.impactHint,
          raw_diff: { before: record.before ?? null, after: record.after ?? null },
        })),
      )
      .select("id");
    if (error) throw error;
    return (data as { id: string }[]).map((row) => row.id);
  }

  async insertChangelogEntries(vendorId: string, entries: ChangelogEntry[]): Promise<ChangelogEntry[]> {
    if (entries.length === 0) return [];

    const externalIds = entries.map((entry) => entry.externalId);
    const { data: existing, error: selectError } = await this.db
      .from("changelog_entries")
      .select("external_id")
      .eq("vendor_id", vendorId)
      .in("external_id", externalIds);
    if (selectError) throw selectError;

    const known = new Set((existing as { external_id: string }[]).map((row) => row.external_id));
    const fresh = entries.filter((entry) => !known.has(entry.externalId));
    if (fresh.length === 0) return [];

    const { error: insertError } = await this.db.from("changelog_entries").insert(
      fresh.map((entry) => ({
        vendor_id: vendorId,
        external_id: entry.externalId,
        title: entry.title,
        url: entry.url,
        published_at: entry.publishedAt.toISOString(),
        content: entry.content,
      })),
    );
    if (insertError) throw insertError;
    return fresh;
  }

  async recordRun(
    vendorId: string,
    startedAt: Date,
    outcome: { status: PollOutcome["status"]; changesFound: number; error?: string },
  ): Promise<void> {
    const { error } = await this.db.from("poll_runs").insert({
      vendor_id: vendorId,
      status: outcome.status,
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      changes_found: outcome.changesFound,
      error: sanitizeText(outcome.error),
    });
    if (error) throw error;
  }

  async updateVendorState(
    vendorId: string,
    patch: {
      etag?: string | null;
      lastModified?: string | null;
      lastContentHash?: string;
      nextPollAt?: Date;
      lastError?: string | null;
    },
  ): Promise<void> {
    const { error } = await this.db
      .from("vendors")
      .update({
        etag: patch.etag,
        last_modified: patch.lastModified,
        last_content_hash: patch.lastContentHash,
        next_poll_at: patch.nextPollAt?.toISOString(),
        last_error: sanitizeText(patch.lastError),
        updated_at: new Date().toISOString(),
      })
      .eq("id", vendorId);
    if (error) throw error;
  }

  async reserveLlmCalls(vendorId: string, requested: number, monthlyCap: number): Promise<number> {
    const { data, error } = await this.db.rpc("reserve_llm_calls", {
      p_vendor_id: vendorId,
      p_requested: requested,
      p_monthly_cap: monthlyCap,
    });
    if (error) throw error;
    return data as number;
  }
}
