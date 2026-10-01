"use server";

import { getUser } from "@/lib/clerk-auth";
import { revalidatePath } from "next/cache";
import { serviceClient } from "@/modules/db/client";
import { FREE_VENDOR_LIMIT, ensureSubscriptionRow, getPlan } from "@/modules/billing/plan";

export async function toggleWatchAction(formData: FormData): Promise<void> {
  const user = await getUser();
  if (!user) throw new Error("unauthorized");
  const vendorId = String(formData.get("vendor_id") ?? "");
  if (!vendorId) return;

  const db = serviceClient();
  const { data: existing } = await db
    .from("watchlist")
    .select("id")
    .eq("user_id", user.id)
    .eq("vendor_id", vendorId)
    .maybeSingle();

  if (existing) {
    await db.from("watchlist").delete().eq("id", (existing as { id: string }).id);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/apis");
    return;
  }

  const plan = await getPlan(user.id);
  if (plan === "free") {
    const { count } = await db
      .from("watchlist")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if ((count ?? 0) >= FREE_VENDOR_LIMIT) {
      throw new Error(
        `Free plan watches up to ${FREE_VENDOR_LIMIT} APIs. Upgrade to Pro for unlimited.`,
      );
    }
  }

  await db.from("watchlist").insert({ user_id: user.id, vendor_id: vendorId });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/apis");
}

export async function setNotifyAllAction(formData: FormData): Promise<void> {
  const user = await getUser();
  if (!user) throw new Error("unauthorized");
  const vendorId = String(formData.get("vendor_id") ?? "");
  const value = formData.get("value") === "true";
  if (!vendorId) return;

  const db = serviceClient();
  await db
    .from("watchlist")
    .update({ notify_all: value })
    .eq("user_id", user.id)
    .eq("vendor_id", vendorId);
  revalidatePath("/dashboard");
}

export async function setSlackWebhookAction(formData: FormData): Promise<void> {
  const user = await getUser();
  if (!user) throw new Error("unauthorized");
  const vendorId = String(formData.get("vendor_id") ?? "");
  const raw = String(formData.get("slack_webhook_url") ?? "").trim();
  if (!vendorId) return;
  if (raw && !raw.startsWith("https://hooks.slack.com/")) {
    throw new Error("Slack webhook URLs start with https://hooks.slack.com/");
  }

  const db = serviceClient();
  await db
    .from("watchlist")
    .update({ slack_webhook_url: raw || null })
    .eq("user_id", user.id)
    .eq("vendor_id", vendorId);
  revalidatePath("/dashboard");
}

export async function requestVendorAction(formData: FormData): Promise<void> {
  const user = await getUser();
  if (!user) throw new Error("unauthorized");
  const vendorName = String(formData.get("vendor_name") ?? "").trim();
  if (!vendorName) return;
  await ensureSubscriptionRow(user.id);

  const db = serviceClient();
  await db.from("vendor_requests").insert({
    user_id: user.id,
    vendor_name: vendorName.slice(0, 120),
    spec_or_docs_url: String(formData.get("spec_or_docs_url") ?? "").trim() || null,
    note: String(formData.get("note") ?? "").trim() || null,
  });
  revalidatePath("/dashboard/settings");
}