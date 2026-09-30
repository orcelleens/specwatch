import type { ClassifiedChange, ChangelogEntry, VendorConfig } from "@/engine/types";
import { serviceClient } from "@/modules/db/client";
import { getPlan } from "@/modules/billing/plan";
import { alertEmail, sendEmail } from "./email";
import { sendSlack } from "./slack";

interface WatcherRow {
  user_id: string;
  notify_all: boolean;
  slack_webhook_url: string | null;
}

export async function primaryEmail(userId: string): Promise<string | null> {
  const db = serviceClient();
  const { data, error } = await db.auth.admin.getUserById(userId);
  if (error || !data.user) return null;
  return data.user.email ?? null;
}

/**
 * Instant dispatch for paid plans (within cron granularity). Free plans are
 * covered by the weekly digest instead. Changes are marked notified even when
 * only Slack fired, so a change is never double-alerted.
 */
export async function handleChanges(
  vendor: VendorConfig,
  changes: ClassifiedChange[],
  entries: ChangelogEntry[],
  changeIds: string[],
): Promise<void> {
  const db = serviceClient();
  const { data, error } = await db
    .from("watchlist")
    .select("user_id, notify_all, slack_webhook_url")
    .eq("vendor_id", vendor.id);
  if (error || !data || data.length === 0) return;

  const watchers = data as WatcherRow[];
  const hasImportant =
    entries.length > 0 ||
    changes.some((change) => change.severity === "breaking" || change.severity === "deprecation");

  for (const watcher of watchers) {
    const plan = await getPlan(watcher.user_id);
    if (plan === "free") continue;
    if (!watcher.notify_all && !hasImportant) continue;

    const email = await primaryEmail(watcher.user_id);
    if (email) {
      const template = alertEmail({
        vendorName: vendor.name,
        changes,
        entries,
        permalinkBase: process.env.APP_URL ?? "https://specwatch.dev",
      });
      await sendEmail({ to: email, subject: template.subject, html: template.html });
    }
    if (watcher.slack_webhook_url) {
      await sendSlack(watcher.slack_webhook_url, vendor.name, changes, entries);
    }
  }

  if (changeIds.length > 0) {
    await db
      .from("changes")
      .update({ notified_at: new Date().toISOString() })
      .in("id", changeIds);
  }
}
