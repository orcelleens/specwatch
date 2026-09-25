"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { createCheckoutSession, createPortalSession } from "./polar";
import { ensureSubscriptionRow } from "./plan";

export async function upgradeAction(formData: FormData): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");
  const plan = formData.get("plan") === "team" ? "team" : "pro";

  let email: string | undefined;
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    email = user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId)
      ?.emailAddress;
  } catch {
    // optional
  }

  await ensureSubscriptionRow(userId);
  const url = await createCheckoutSession({ userId, email, plan });
  redirect(url);
}

export async function portalAction(): Promise<void> {
  const { userId } = await auth();
  if (!userId) throw new Error("unauthorized");
  const url = await createPortalSession({ userId });
  redirect(url);
}
