import { cronAuth } from "@/lib/cron";
import { runPrune } from "@/modules/maintenance/prune";

export const maxDuration = 120;

export async function GET(request: Request) {
  const denied = cronAuth(request);
  if (denied) return denied;
  const result = await runPrune();
  return Response.json(result);
}
