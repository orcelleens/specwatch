"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/clerk-auth";
import { serviceClient } from "@/modules/db/client";
import { FREE_VENDOR_LIMIT, getPlan } from "@/modules/billing/plan";
import { createCustomVendor } from "./custom";

/**
 * "Add any API" — paste a spec / docs / homepage URL, we discover what to
 * watch and start watching it as a private vendor owned by this user.
 * Result is surfaced via ?added=<kind> / ?addError=<msg> on /dashboard/apis.
 */
export async function addCustomApiAction(formData: FormData): Promise<void> {
  const user = await getUser();
  if (!user) throw new Error("unauthorized");

  const url = String(formData.get("url") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!url) redirect("/dashboard/apis?addError=missing-url");

  const db = serviceClient();

  // Custom APIs count toward the same free-plan watch limit as catalog APIs.
  const plan = await getPlan(user.id);
  if (plan === "free") {
    const { count } = await db
      .from("watchlist")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if ((count ?? 0) >= FREE_VENDOR_LIMIT) {
      redirect(
        `/dashboard/apis?addError=${encodeURIComponent(
          `Free plan watches up to ${FREE_VENDOR_LIMIT} APIs. Upgrade to Pro for unlimited.`,
        )}`,
      );
    }
  }

  try {
    const result = await createCustomVendor(db, user.id, { url, name: name || undefined });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/apis");
    redirect(`/dashboard/apis?added=${encodeURIComponent(result.kind)}`);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("NEXT_REDIRECT")) throw err;
    const message = err instanceof Error ? err.message : "Something went wrong adding that API.";
    redirect(`/dashboard/apis?addError=${encodeURIComponent(message.slice(0, 200))}`);
  }
}
