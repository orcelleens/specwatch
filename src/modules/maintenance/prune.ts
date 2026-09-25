import { serviceClient } from "@/modules/db/client";

interface SnapshotRow {
  id: string;
  storage_path: string;
  vendor_id: string;
  fetched_at: string;
  parse_ok: boolean;
}

/**
 * Delete spec snapshots older than 90 days, always keeping the newest
 * parseable snapshot per vendor (it is the diff baseline). Change rows
 * survive via ON DELETE SET NULL; their permalink pages stay functional.
 */
export async function runPrune(): Promise<{ deleted: number }> {
  const db = serviceClient();
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  const { data: oldRows } = await db
    .from("spec_snapshots")
    .select("id, storage_path, vendor_id, fetched_at, parse_ok")
    .lt("fetched_at", cutoff);
  if (!oldRows || oldRows.length === 0) return { deleted: 0 };

  const { data: latestRows } = await db
    .from("spec_snapshots")
    .select("id, vendor_id, fetched_at, parse_ok")
    .eq("parse_ok", true)
    .order("fetched_at", { ascending: false });
  if (!latestRows) return { deleted: 0 };

  const baselineIds = new Set<string>();
  for (const row of latestRows as SnapshotRow[]) {
    if (!baselineIds.has(row.vendor_id)) baselineIds.add(row.id);
  }

  const doomed = (oldRows as SnapshotRow[]).filter((row) => !baselineIds.has(row.id));

  const paths = doomed.map((row) => row.storage_path);
  if (paths.length > 0) {
    const { error: storageError } = await db.storage.from("specs").remove(paths);
    if (storageError) throw new Error(storageError.message);
  }
  for (const row of doomed) {
    const { error } = await db.from("spec_snapshots").delete().eq("id", row.id);
    if (error) throw new Error(error.message);
  }
  return { deleted: doomed.length };
}
