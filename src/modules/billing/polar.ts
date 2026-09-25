import { Polar } from "@polar-sh/sdk";
import { serviceClient } from "@/modules/db/client";

export function polarClient(): Polar {
  const token = process.env.POLAR_ACCESS_TOKEN;
  if (!token) throw new Error("POLAR_ACCESS_TOKEN not set");
  return new Polar({ accessToken: token });
}

export async function createCheckoutSession(params: {
  userId: string;
  email?: string;
  plan: "pro" | "team";
}): Promise<string> {
  const polar = polarClient();
  const productId =
    params.plan === "team"
      ? process.env.POLAR_PRODUCT_TEAM_MONTHLY!
      : process.env.POLAR_PRODUCT_PRO_MONTHLY!;
  const checkout = await polar.checkouts.create({
    products: [productId],
    customerEmail: params.email ?? undefined,
    // checkout metadata is propagated to the subscription, so webhook
    // events carry the userId back to us
    metadata: { userId: params.userId },
    successUrl: `${process.env.APP_URL}/dashboard/settings?upgraded=1`,
    allowDiscountCodes: true,
  });
  return checkout.url;
}

export async function createPortalSession(params: { userId: string }): Promise<string> {
  const polar = polarClient();
  const db = serviceClient();
  const { data } = await db
    .from("subscriptions")
    .select("polar_customer_id")
    .eq("user_id", params.userId)
    .maybeSingle();
  const customerId = (data as { polar_customer_id: string | null } | null)?.polar_customer_id;
  if (!customerId) throw new Error("No Polar customer on file yet");

  const session = await polar.customerSessions.create({
    customerId,
    returnUrl: `${process.env.APP_URL}/dashboard/settings`,
  });
  return session.customerPortalUrl;
}

export async function upsertSubscription(params: {
  userId: string;
  polarCustomerId: string | null;
  polarSubscriptionId: string | null;
  plan: "free" | "pro" | "team";
  status: string;
  currentPeriodEnd: Date | null;
}): Promise<void> {
  const db = serviceClient();
  const { error } = await db
    .from("subscriptions")
    .upsert(
      {
        user_id: params.userId,
        polar_customer_id: params.polarCustomerId,
        polar_subscription_id: params.polarSubscriptionId,
        plan: params.plan,
        status: params.status,
        current_period_end: params.currentPeriodEnd?.toISOString() ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  if (error) throw error;
}
