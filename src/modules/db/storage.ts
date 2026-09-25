import type { SupabaseClient } from "@supabase/supabase-js";
import type { SnapshotStorage } from "@/engine/scheduler";

export class SupabaseSnapshotStorage implements SnapshotStorage {
  constructor(private db: SupabaseClient) {}

  async put(path: string, data: Buffer): Promise<void> {
    const { error } = await this.db.storage
      .from("specs")
      .upload(path, new Uint8Array(data), {
        contentType: "application/gzip",
        upsert: true,
      });
    if (error) throw new Error(`storage upload ${path}: ${error.message}`);
  }

  async get(path: string): Promise<Buffer> {
    const { data, error } = await this.db.storage.from("specs").download(path);
    if (error) throw new Error(`storage download ${path}: ${error.message}`);
    return Buffer.from(await data.arrayBuffer());
  }
}
