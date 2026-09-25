import type { ClassifiedChange, ChangelogEntry } from "@/engine/types";
import { serviceClient } from "@/modules/db/client";
import { getPlan } from "@/modules/billing/plan";
import { digestEmail, sendEmail } from "./email";
import { primaryEmail } from "./detect";

interface ChangeRow {
  id: string;
  vendor_id: string;
  json_path: string;
  kind: string;
  severity: ClassifiedChange["severity"];
  summary: string | null;
  impact_hint: string | null;
  detected_at: string;
}

interface EntryRow {
  vendor_id: string;
  title: string;
  url: string | null;
  published_at: string;
}

/** Weekly digest for free-plan users. Idempotent per (user, period) via digest_queue. */
export async function runDigest(): Promise<{ sent: number; skipped: number; failed: number }> {
  const db = serviceClient();
  const periodEnd = new Date();
  const windowStart = new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
  // Idempotency key: start of the current ISO week (Monday 00:00 UTC), so a
  // second run in the same week is skipped instead of re-sending. The data
  // window stays rolling 7 days.
  const weekday = (periodEnd.getUTCDay() + 6) % 7;
  const periodStart = new Date(
    Date.UTC(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth(), periodEnd.getUTCDate() - weekday),
  );

  const { data: watcherRows } = await db
    .from("watchlist")
    .select("user_id, vendor_id, vendors!inner(name)");
  if (!watcherRows || watcherRows.length === 0) return { sent: 0, skipped: 0, failed: 0 };

  const byUser = new Map<string, { vendorId: string; vendorName: string }[]>();
  for (const row of watcherRows as (typeof watcherRows)[number][]) {
    const list = byUser.get(row.user_id) ?? [];
    list.push({ vendorId: row.vendor_id, vendorName: (row.vendors as unknown as { name: string }).name });
    byUser.set(row.user_id, list);
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const [userId, vendors] of byUser) {
    const plan = await getPlan(userId);
    if (plan !== "free") continue; // paid plans get instant alerts

    // idempotency: skip if this period was already processed
    const { data: existing } = await db
      .from("digest_queue")
      .select("id")
      .eq("user_id", userId)
      .eq("period_start", periodStart.toISOString())
      .maybeSingle();
    if (existing) {
      skipped++;
      continue;
    }
    await db.from("digest_queue").insert({
      user_id: userId,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
    });

    const vendorIds = vendors.map((vendor) => vendor.vendorId);
    const namesById = new Map(vendors.map((vendor) => [vendor.vendorId, vendor.vendorName]));

    const [{ data: changeRows }, { data: entryRows }] = await Promise.all([
      db
        .from("changes")
        .select("id, vendor_id, json_path, kind, severity, summary, impact_hint, detected_at")
        .in("vendor_id", vendorIds)
        .gte("detected_at", windowStart.toISOString())
        .order("detected_at", { ascending: false }),
      db
        .from("changelog_entries")
        .select("vendor_id, title, url, published_at")
        .in("vendor_id", vendorIds)
        .gte("published_at", windowStart.toISOString())
        .order("published_at", { ascending: false }),
    ]);

    const changes = (changeRows ?? []) as ChangeRow[];
    const entries = (entryRows ?? []) as EntryRow[];
    const relevantEntryIds = new Set(entries.map((entry) => entry.vendor_id));
    const relevantChangeIds = new Set(changes.map((change) => change.vendor_id));
    const touched = new Set([...relevantEntryIds, ...relevantChangeIds]);
    if (touched.size === 0) {
      sent++; // quiet week: recorded, nothing to send
      continue;
    }

    const groups = [...touched].map((vendorId) => ({
      vendorName: namesById.get(vendorId) ?? "Watched API",
      changes: changes
        .filter((change) => change.vendor_id === vendorId)
        .map<ClassifiedChange>((change) => ({
          jsonPath: change.json_path,
          kind: change.kind,
          severity: change.severity,
          summary: change.summary ?? undefined,
          impactHint: change.impact_hint ?? undefined,
        })),
      entries: entries
        .filter((entry) => entry.vendor_id === vendorId)
        .map<ChangelogEntry>((entry) => ({
          externalId: entry.title,
          title: entry.title,
          url: entry.url ?? undefined,
          publishedAt: new Date(entry.published_at),
        })),
    }));

    const email = await primaryEmail(userId);
    if (!email) {
      failed++;
      await db.from("digest_queue").update({ status: "failed", attempts: 1 }).eq("user_id", userId).eq("period_start", periodStart.toISOString());
      continue;
    }

    try {
      const template = digestEmail({ groups });
      await sendEmail({ to: email, subject: template.subject, html: template.html });
      await db
        .from("digest_queue")
        .update({ status: "sent", sent_at: new Date().toISOString(), attempts: 1 })
        .eq("user_id", userId)
        .eq("period_start", periodStart.toISOString());
      sent++;
    } catch {
      failed++;
      await db
        .from("digest_queue")
        .update({ status: "failed", attempts: 1 })
        .eq("user_id", userId)
        .eq("period_start", periodStart.toISOString());
    }
  }

  return { sent, skipped, failed };
}
