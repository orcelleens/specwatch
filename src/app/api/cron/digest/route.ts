import { cronAuth } from "@/lib/cron";
import { runDigest } from "@/modules/notify/digest";

export const maxDuration = 300;

export async function GET(request: Request) {
  const denied = cronAuth(request);
  if (denied) return denied;
  const result = await runDigest();
  return Response.json(result);
}
