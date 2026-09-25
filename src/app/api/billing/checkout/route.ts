import { auth, clerkClient } from "@clerk/nextjs/server";
import { createCheckoutSession } from "@/modules/billing/polar";
import { ensureSubscriptionRow } from "@/modules/billing/plan";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { plan?: string };
  const plan = body.plan === "team" ? "team" : "pro";

  let email: string | undefined;
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    email = user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId)
      ?.emailAddress;
  } catch {
    // email is an optimization, not a requirement
  }

  await ensureSubscriptionRow(userId);
  const url = await createCheckoutSession({ userId, email, plan });
  return Response.json({ url });
}
