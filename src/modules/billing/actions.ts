"use server";

import { getUser } from "@/lib/supabase-server";
import { redirect } from "next/navigation";
import { createCheckoutSession, createPortalSession } from "./polar";
import { ensureSubscriptionRow } from "./plan";

export async function upgradeAction(formData: FormData): Promise<void> {
  const user = await getUser();
  if (!user) throw new Error("unauthorized");
  const plan = formData.get("plan") === "team" ? "team" : "pro";

  const email = user.email;

  await ensureSubscriptionRow(user.id);
  const url = await createCheckoutSession({ userId: user.id, email, plan });
  redirect(url);
}

export async function portalAction(): Promise<void> {
  const user = await getUser();
  if (!user) throw new Error("unauthorized");
  const url = await createPortalSession({ userId: user.id });
  redirect(url);
}