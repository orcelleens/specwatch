import { validateEvent } from "@polar-sh/sdk/webhooks";
import { serviceClient } from "@/modules/db/client";
import { upsertSubscription } from "@/modules/billing/polar";
import { planFromProductId } from "@/modules/billing/plan";

export const maxDuration = 60;

interface SubscriptionData {
  id: string;
  status: string;
  productId: string;
  customerId: string;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean | null;
  metadata?: Record<string, string | number | boolean | Date> | null;
}

// statuses that keep paid access alive (dunning grace included)
const PAID_STATUSES = new Set(["active", "trialing", "past_due"]);

type Db = ReturnType<typeof serviceClient>;

async function resolveUserId(db: Db, sub: SubscriptionData): Promise<string | null> {
  // checkout metadata is propagated to the subscription on creation
  const fromMetadata = sub.metadata?.userId;
  if (typeof fromMetadata === "string" && fromMetadata) return fromMetadata;

  const { data: bySub } = await db
    .from("subscriptions")
    .select("user_id")
    .eq("polar_subscription_id", sub.id)
    .maybeSingle();
  if (bySub) return (bySub as { user_id: string }).user_id;

  const { data: byCustomer } = await db
    .from("subscriptions")
    .select("user_id")
    .eq("polar_customer_id", sub.customerId)
    .maybeSingle();
  if (byCustomer) return (byCustomer as { user_id: string }).user_id;

  return null;
}

export async function POST(request: Request) {
  const secret = process.env.POLAR_WEBHOOK_SECRET;
  if (!secret) return new Response("POLAR_WEBHOOK_SECRET not set", { status: 500 });

  const body = await request.text();
  let type: string;
  let timestamp: Date;
  let data: unknown;
  try {
    const event = validateEvent(body, Object.fromEntries(request.headers), secret);
    type = event.type;
    timestamp = event.timestamp;
    data = event.data;
  } catch {
    return new Response("invalid signature", { status: 400 });
  }

  // Polar events carry no server-assigned id; a retried delivery repeats
  // type + timestamp + object id, so that triple is the idempotency key
  const objectId = (data as { id?: string } | null)?.id ?? "";
  const eventId = `${type}:${objectId}:${timestamp instanceof Date ? timestamp.toISOString() : ""}`;

  const db = serviceClient();
  const { data: seen } = await db
    .from("polar_events")
    .insert({ event_id: eventId, type, payload: data as Record<string, unknown> })
    .select("id")
    .maybeSingle();
  if (!seen) return Response.json({ received: true, duplicate: true });

  try {
    if (type.startsWith("subscription.")) {
      const sub = data as unknown as SubscriptionData;
      const userId = await resolveUserId(db, sub);
      if (!userId) return Response.json({ received: true, ignored: "no user" });

      const paid = PAID_STATUSES.has(sub.status);

      if (type === "subscription.revoked") {
        await upsertSubscription({
          userId,
          polarCustomerId: sub.customerId,
          polarSubscriptionId: null,
          plan: "free",
          status: "canceled",
          currentPeriodEnd: null,
        });
      } else if (type === "subscription.canceled" && sub.cancelAtPeriodEnd) {
        // access continues until the period ends; getPlan's period check downgrades after
        await upsertSubscription({
          userId,
          polarCustomerId: sub.customerId,
          polarSubscriptionId: sub.id,
          plan: planFromProductId(sub.productId),
          status: "active",
          currentPeriodEnd: sub.currentPeriodEnd ?? null,
        });
      } else {
        await upsertSubscription({
          userId,
          polarCustomerId: sub.customerId,
          polarSubscriptionId: sub.id,
          plan: paid ? planFromProductId(sub.productId) : "free",
          status: paid ? "active" : sub.status,
          currentPeriodEnd: sub.currentPeriodEnd ?? null,
        });
      }
    }
  } catch (err) {
    console.error("polar webhook handling failed", type, err);
    return new Response("handler error", { status: 500 });
  }

  return Response.json({ received: true });
}
