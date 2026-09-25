import { cronAuth } from "@/lib/cron";
import { runTick } from "@/engine/scheduler";
import { createClassifier } from "@/engine/classifier";
import { serviceClient } from "@/modules/db/client";
import { SupabaseStore } from "@/modules/db/supabase-store";
import { SupabaseSnapshotStorage } from "@/modules/db/storage";
import { handleChanges } from "@/modules/notify/detect";

export const maxDuration = 300;

export async function GET(request: Request) {
  const denied = cronAuth(request);
  if (denied) return denied;

  const db = serviceClient();
  const outcomes = await runTick({
    store: new SupabaseStore(db),
    storage: new SupabaseSnapshotStorage(db),
    classifier: createClassifier(),
    onChanges: handleChanges,
  });

  return Response.json({
    polled: outcomes.length,
    outcomes,
  });
}
