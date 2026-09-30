import { getUser } from "@/lib/supabase-server";
import { createCheckoutSession } from "@/modules/billing/polar";
import { ensureSubscriptionRow } from "@/modules/billing/plan";

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { plan?: string };
  const plan = body.plan === "team" ? "team" : "pro";

  const email = user.email;

  await ensureSubscriptionRow(user.id);
  const url = await createCheckoutSession({ userId: user.id, email, plan });
  return Response.json({ url });
}