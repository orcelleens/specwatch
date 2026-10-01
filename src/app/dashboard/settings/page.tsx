import { getUser } from "@/lib/clerk-auth";
import { Check, Sparkles, TrendingUp, ArrowRight } from "lucide-react";
import { getPlan } from "@/modules/billing/plan";
import { portalAction, upgradeAction } from "@/modules/billing/actions";
import { requestVendorAction } from "@/modules/watchlist/actions";

export const metadata = { title: "Settings" };

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    features: ["Watch 3 APIs", "Weekly digest email"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$19/mo",
    features: ["Unlimited APIs", "Within-minutes email alerts", "Slack alerts"],
  },
  {
    id: "team",
    name: "Team",
    price: "$49/mo",
    features: ["Everything in Pro", "Share watchlist across seats"],
  },
];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getUser();
  if (!user) return null;
  const plan = await getPlan(user.id);
  const params = await searchParams;
  const upgraded = params.upgraded === "1";

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Settings
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Plan and alert preferences.
          </p>
        </div>
        {upgraded && (
          <div className="flex items-center gap-2 rounded-md bg-emerald-950/20 px-3 py-1.5 text-sm">
            <Sparkles className="mr-2 h-4 w-4 text-emerald-400" />
            <span>Payment received — alerts are now within-minutes for everything you watch.</span>
          </div>
        )}
      </header>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Plan
          </h2>
          {plan !== "free" && (
            <form action={portalAction} className="text-xs text-zinc-400 hover:text-zinc-300 underline-offset-2 hover:underline">
              Manage billing via Polar portal
            </form>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {PLANS.map((tier) => {
            const current = tier.id === plan;
            return (
              <div
                key={tier.id}
                className={`group relative overflow-hidden rounded-lg border p-4 ${
                  current
                    ? "border-orange-600 bg-zinc-900/80"
                    : "border-zinc-800 bg-zinc-900/40"
                }`}
              >
                <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent,rgba(15,23,42,0.05))] pointer-events-none" />
                <div className="relative z-10">
                  <div className="flex items-baseline justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className={`h-6 w-6 ${current ? "bg-orange-500" : "bg-zinc-800/50"} rounded`} />
                      <span className="font-semibold">{tier.name}</span>
                    </div>
                    <span className="text-sm text-zinc-400">{tier.price}</span>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-xs text-zinc-400">
                        <Check className="mt-0.5 shrink-0 h-4 w-4 text-emerald-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6">
                    {current ? (
                      <div className="flex items-center gap-2 rounded-md bg-orange-500/20 px-3 py-1.5 text-xs font-medium">
                        <TrendingUp className="mr-1 h-3 w-3 text-orange-400" />
                        <span>Current plan</span>
                      </div>
                    ) : tier.id === "free" ? null : (
                      <form action={upgradeAction}>
                        <input type="hidden" name="plan" value={tier.id} />
                        <button
                          type="submit"
                          className="w-full flex items-center justify-center gap-2 rounded-md bg-orange-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-orange-400 transition-colors duration-200"
                        >
                          <ArrowRight className="mr-2 h-3 w-3" />
                          Upgrade to {tier.name}
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Request an API
          </h2>
          <p className="text-xs text-zinc-400">
            Help us expand SpecWatch by suggesting APIs you&apos;d like to monitor
          </p>
        </div>
        <form
          action={requestVendorAction}
          className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-900/40 p-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <label className="block text-xs text-zinc-400">
                API vendor name
              </label>
              <input
                name="vendor_name"
                required
                placeholder="e.g. Notion"
                className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div className="space-y-3">
              <label className="block text-xs text-zinc-400">
                Spec or docs URL (if you know it)
              </label>
              <input
                name="spec_or_docs_url"
                type="url"
                placeholder="https://raw.githubusercontent.com/…/openapi.yaml"
                className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="space-y-4">
            <label className="block text-xs text-zinc-400">
              Why do you depend on it? (optional)
            </label>
            <textarea
              name="note"
              rows={3}
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none"
              placeholder="Why do you depend on it? (optional)"
            />
          </div>
          <div className="mt-6">
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 rounded-md bg-orange-500 px-4 py-3 text-xs font-semibold text-zinc-950 hover:bg-orange-400 transition-colors duration-200"
            >
              <ArrowRight className="mr-2 h-3 w-3" />
              Send request
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
