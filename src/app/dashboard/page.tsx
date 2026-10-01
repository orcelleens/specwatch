import Link from "next/link";
import { getUser } from "@/lib/clerk-auth";
import { AlertTriangle, Plus, RefreshCw } from "lucide-react";
import { serviceClient } from "@/modules/db/client";
import { ensureSubscriptionRow, FREE_VENDOR_LIMIT, getPlan } from "@/modules/billing/plan";
import { ChangeCard, type ChangeCardData } from "@/components/change-card";
import { refreshAction } from "./actions";

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
  const user = await getUser();
  if (!user) return null;
  const db = serviceClient();
  await ensureSubscriptionRow(user.id);
  const plan = await getPlan(user.id);

  const { data: watchRows } = await db
    .from("watchlist")
    .select("vendor_id, notify_all, slack_webhook_url, vendors(slug, name, last_error)")
    .eq("user_id", user.id)
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
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">
            Your watched APIs
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {watched.length} watched
            {plan === "free" ? ` — free plan covers up to ${FREE_VENDOR_LIMIT}` : ""} ·{" "}
            <Link href="/dashboard/apis" className="text-orange-400 hover:text-orange-300">
              add more
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-zinc-700 px-3 py-1 text-xs font-medium uppercase tracking-wider text-zinc-400">
            {plan} plan
          </span>
          <form action={refreshAction}>
            <button
              type="submit"
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-600 hover:text-zinc-200 transition-colors duration-200"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </button>
          </form>
        </div>
      </header>

      {watched.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="rounded-lg border border-dashed border-zinc-700 p-8 text-center">
            <Plus className="mx-auto mb-4 text-zinc-600" size={32} />
            <p className="text-sm text-zinc-500">You are not watching any APIs yet.</p>
            <Link
              href="/dashboard/apis"
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-orange-400 transition-colors duration-200"
            >
              Pick your first API
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {watched.map((row) => {
              const vendor = row.vendors[0];
              if (!vendor) {
                return (
                  <div key={row.vendor_id} className="group">
                    <div className="relative overflow-hidden">
                      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(15,23,42,0.05))] pointer-events-none" />
                      <div className="relative z-10">
                        <div className="flex flex-wrap items-center gap-3 mb-4 py-3 px-4 bg-zinc-900/50 rounded-lg">
                          <span className="block font-semibold text-zinc-100">Unknown API (not configured)</span>
                          <span className="flex items-center gap-2 text-xs text-red-400">
                            <AlertTriangle className="h-4 w-4" /> vendor missing
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }
              return (
                <div key={row.vendor_id} className="group">
                  <div className="relative overflow-hidden">
                    <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(15,23,42,0.05))] pointer-events-none" />
                    <div className="relative z-10">
                      <div className="flex flex-wrap items-center gap-3 mb-4 py-3 px-4 bg-zinc-900/50 rounded-lg">
                        <Link
                          href={`/vendors/${vendor.slug}`}
                          className="block font-semibold text-zinc-100 hover:text-orange-400 transition-colors duration-200 group-hover:text-orange-300"
                        >
                          {vendor.name}
                        </Link>
                        {vendor.last_error ? (
                        <span className="flex items-center gap-2 text-xs text-red-400">
                          <AlertTriangle className="h-4 w-4" /> last poll failed
                        </span>
                      ) : null}
                      <div className="ml-auto flex items-center gap-2">
                        <button
                          disabled
                          className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 transition-colors duration-200"
                        >
                          Poll now
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-zinc-500">
                        <span className="font-medium">Alerts:</span>
                        <span className="ml-auto">
                          {row.notify_all ? "Every change" : "Breaking + deprecations only"}
                        </span>
                      </div>
                      {row.slack_webhook_url ? (
                        <div className="flex items-center gap-2 text-sm text-zinc-500">
                          <span className="font-medium">Slack:</span>
                          <span className="ml-auto text-xs truncate max-w-[150px]">
                            {row.slack_webhook_url}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          </div>
        </div>
      )}

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Latest changes on your APIs
          </h2>
          {changes.length > 0 && (
            <Link
              href="/dashboard/changes"
              className="text-xs text-zinc-400 hover:text-zinc-300 underline-offset-2 hover:underline"
            >
              View all
            </Link>
          )}
        </div>
        {changes.length === 0 ? (
          <div className="mt-6 flex flex-col items-center justify-center py-8">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-6 text-center">
              <p className="text-sm text-zinc-500">
                Nothing detected yet. The engine polls each API on a schedule — changes land here and
                in your inbox within minutes.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {changes.map((change) => {
              const cv = change.vendors[0];
              if (!cv) return null;
              return (
                <ChangeCard
                  key={change.id}
                  change={{
                    id: change.id,
                    vendorSlug: cv.slug,
                    vendorName: cv.name,
                    jsonPath: change.json_path,
                    kind: change.kind,
                    severity: change.severity,
                    summary: change.summary,
                    impactHint: change.impact_hint,
                    detectedAt: change.detected_at,
                  }}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
