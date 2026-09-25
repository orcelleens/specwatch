import { serviceClient } from "@/modules/db/client";

export type Plan = "free" | "pro" | "team";

interface SubscriptionRow {
  plan: Plan;
  status: string;
  current_period_end: string | null;
}

export const FREE_VENDOR_LIMIT = 3;

export async function getPlan(userId: string): Promise<Plan> {
  const db = serviceClient();
  const { data } = await db
    .from("subscriptions")
    .select("plan, status, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return "free";
  const row = data as SubscriptionRow;
  const active =
    row.status === "active" &&
    (!row.current_period_end || new Date(row.current_period_end) > new Date());
  return active ? row.plan : "free";
}

/** Called on first sign-in so every user has a subscriptions row (plan=free). */
export async function ensureSubscriptionRow(userId: string): Promise<void> {
  const db = serviceClient();
  await db
    .from("subscriptions")
    .upsert({ user_id: userId, plan: "free", status: "active" }, { onConflict: "user_id" });
}

export function planFromProductId(productId: string | null | undefined): Plan {
  if (productId && productId === process.env.POLAR_PRODUCT_TEAM_MONTHLY) return "team";
  if (productId && productId === process.env.POLAR_PRODUCT_PRO_MONTHLY) return "pro";
  return "free";
}
