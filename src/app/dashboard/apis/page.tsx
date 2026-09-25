import { auth } from "@clerk/nextjs/server";
import { Eye, EyeOff } from "lucide-react";
import { serviceClient } from "@/modules/db/client";
import { FREE_VENDOR_LIMIT, getPlan } from "@/modules/billing/plan";
import { toggleWatchAction } from "@/modules/watchlist/actions";

interface VendorRow {
  id: string;
  slug: string;
  name: string;
  homepage: string | null;
  changelog: { type: string };
  poll_interval_minutes: number;
}

export const metadata = { title: "My APIs" };

export default async function ApisPage() {
  const { userId } = await auth();
  if (!userId) return null;
  const db = serviceClient();
  const plan = await getPlan(userId);

  const [{ data: vendorRows }, { data: watchRows }] = await Promise.all([
    db.from("vendors").select("id, slug, name, homepage, changelog, poll_interval_minutes").order("name"),
    db.from("watchlist").select("vendor_id").eq("user_id", userId),
  ]);

  const vendors = (vendorRows ?? []) as VendorRow[];
  const watchedIds = new Set(((watchRows ?? []) as { vendor_id: string }[]).map((r) => r.vendor_id));
  const freeSlotsUsed = watchedIds.size;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Watched API catalog</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {plan === "free" ? (
            <>
              Free plan: {freeSlotsUsed} of {FREE_VENDOR_LIMIT} slots used —{" "}
              <a href="/dashboard/settings" className="text-orange-400 hover:text-orange-300">
                upgrade for unlimited
              </a>
            </>
          ) : (
            `${freeSlotsUsed} APIs watched — unlimited on ${plan}`
          )}
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {vendors.map((vendor) => {
          const watched = watchedIds.has(vendor.id);
          return (
            <div
              key={vendor.id}
              className={`rounded-lg border p-4 transition-colors ${
                watched
                  ? "border-orange-800/60 bg-zinc-900/80"
                  : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <a
                    href={vendor.homepage ?? `https://${vendor.slug}.com`}
                    className="font-semibold text-zinc-100 hover:text-orange-400"
                  >
                    {vendor.name}
                  </a>
                  <p className="mt-1 text-xs text-zinc-500">
                    polled every {vendor.poll_interval_minutes} min
                    {vendor.changelog?.type && vendor.changelog.type !== "none"
                      ? ` · changelog watched (${vendor.changelog.type})`
                      : " · spec-only"}
                  </p>
                </div>
                <form action={toggleWatchAction}>
                  <input type="hidden" name="vendor_id" value={vendor.id} />
                  <button
                    type="submit"
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      watched
                        ? "border border-zinc-700 text-zinc-400 hover:border-red-800 hover:text-red-300"
                        : "bg-orange-500 text-zinc-950 hover:bg-orange-400"
                    }`}
                  >
                    {watched ? <EyeOff size={13} /> : <Eye size={13} />}
                    {watched ? "Unwatch" : "Watch"}
                  </button>
                </form>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-zinc-600">
        Missing an API you depend on?{" "}
        <a href="/dashboard/settings" className="text-zinc-400 underline underline-offset-2">
          Request it
        </a>{" "}
        — if it has a published OpenAPI spec, it can be watched.
      </p>
    </div>
  );
}
