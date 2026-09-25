import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { AlertTriangle, Plus } from "lucide-react";
import { serviceClient } from "@/modules/db/client";
import { ensureSubscriptionRow, FREE_VENDOR_LIMIT, getPlan } from "@/modules/billing/plan";
import { setNotifyAllAction, setSlackWebhookAction, toggleWatchAction } from "@/modules/watchlist/actions";
import { ChangeCard, type ChangeCardData } from "@/components/change-card";

interface WatchRow {
  vendor_id: string;
  notify_all: boolean;
  slack_webhook_url: string | null;
  vendors: { slug: string; name: string; last_error: string | null }[];
}

interface ChangeRow {
  id: string;
  json_path: string;
  kind: string;
  severity: ChangeCardData["severity"];
  summary: string | null;
  impact_hint: string | null;
  detected_at: string;
  vendors: { slug: string; name: string }[];
}

export const metadata = { title: "Overview" };

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) return null;
  const db = serviceClient();
  await ensureSubscriptionRow(userId);
  const plan = await getPlan(userId);

  const { data: watchRows } = await db
    .from("watchlist")
    .select("vendor_id, notify_all, slack_webhook_url, vendors(slug, name, last_error)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  const watched = (watchRows ?? []) as WatchRow[];
  const vendorIds = watched.map((row) => row.vendor_id);

  let changes: ChangeRow[] = [];
  if (vendorIds.length > 0) {
    const { data: changeRows } = await db
      .from("changes")
      .select("id, json_path, kind, severity, summary, impact_hint, detected_at, vendors(slug, name)")
      .in("vendor_id", vendorIds)
      .order("detected_at", { ascending: false })
      .limit(20);
    changes = (changeRows ?? []) as ChangeRow[];
  }

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your watched APIs</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {watched.length} watched
            {plan === "free" ? ` — free plan covers up to ${FREE_VENDOR_LIMIT}` : ""} ·{" "}
            <Link href="/dashboard/apis" className="text-orange-400 hover:text-orange-300">
              add more
            </Link>
          </p>
        </div>
        <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs font-medium uppercase tracking-wider text-zinc-400">
          {plan} plan
        </span>
      </header>

      {watched.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-700 p-8 text-center">
          <Plus className="mx-auto mb-2 text-zinc-600" size={24} />
          <p className="text-sm text-zinc-400">You are not watching any APIs yet.</p>
          <Link
            href="/dashboard/apis"
            className="mt-3 inline-block rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-orange-400"
          >
            Pick your first API
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {watched.map((row) => (
            <div key={row.vendor_id} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`/vendors/${row.vendors[0].slug}`}
                  className="font-semibold text-zinc-100 hover:text-orange-400"
                >
                  {row.vendors[0].name}
                </Link>
                {row.vendors[0].last_error ? (
                  <span className="flex items-center gap-1 text-xs text-red-400">
                    <AlertTriangle size={12} /> last poll failed
                  </span>
                ) : null}
                <form action={toggleWatchAction} className="ml-auto">
                  <input type="hidden" name="vendor_id" value={row.vendor_id} />
                  <button
                    type="submit"
                    className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 transition-colors hover:border-red-800 hover:text-red-300"
                  >
                    Unwatch
                  </button>
                </form>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-zinc-500">
                <form action={setNotifyAllAction} className="flex items-center gap-2">
                  <input type="hidden" name="vendor_id" value={row.vendor_id} />
                  <input type="hidden" name="value" value={row.notify_all ? "false" : "true"} />
                  <button type="submit" className="underline-offset-2 hover:text-zinc-300 hover:underline">
                    {row.notify_all ? "Alerting on every change" : "Alerting on breaking + deprecations only"}
                  </button>
                </form>
                <form action={setSlackWebhookAction} className="flex flex-1 items-center gap-2">
                  <input type="hidden" name="vendor_id" value={row.vendor_id} />
                  <input
                    type="url"
                    name="slack_webhook_url"
                    defaultValue={row.slack_webhook_url ?? ""}
                    placeholder="https://hooks.slack.com/services/…"
                    className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-300 placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none"
                  />
                  <button type="submit" className="text-orange-400 hover:text-orange-300">
                    save
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Latest changes on your APIs
        </h2>
        {changes.length === 0 ? (
          <p className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-6 text-sm text-zinc-500">
            Nothing detected yet. The engine polls each API on a schedule — changes land here and
            in your inbox within minutes.
          </p>
        ) : (
          <div className="space-y-2.5">
            {changes.map((change) => (
              <ChangeCard
                key={change.id}
                change={{
                  id: change.id,
                  vendorSlug: change.vendors[0].slug,
                  vendorName: change.vendors[0].name,
                  jsonPath: change.json_path,
                  kind: change.kind,
                  severity: change.severity,
                  summary: change.summary,
                  impactHint: change.impact_hint,
                  detectedAt: change.detected_at,
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
