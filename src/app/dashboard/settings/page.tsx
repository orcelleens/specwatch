import { auth } from "@clerk/nextjs/server";
import { Check, Sparkles } from "lucide-react";
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
  const { userId } = await auth();
  if (!userId) return null;
  const plan = await getPlan(userId);
  const params = await searchParams;
  const upgraded = params.upgraded === "1";

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-zinc-500">Plan and alert preferences.</p>
      </header>

      {upgraded ? (
        <div className="rounded-lg border border-emerald-800/60 bg-emerald-950/40 p-4 text-sm text-emerald-300">
          <Sparkles size={14} className="mr-2 inline" />
          Payment received — alerts are now within-minutes for everything you watch.
        </div>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">Plan</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {PLANS.map((tier) => {
            const current = tier.id === plan;
            return (
              <div
                key={tier.id}
                className={`rounded-lg border p-4 ${
                  current ? "border-orange-600 bg-zinc-900/80" : "border-zinc-800 bg-zinc-900/40"
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold">{tier.name}</span>
                  <span className="text-sm text-zinc-400">{tier.price}</span>
                </div>
                <ul className="mt-3 space-y-1.5">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-1.5 text-xs text-zinc-400">
                      <Check size={12} className="mt-0.5 shrink-0 text-emerald-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="mt-4">
                  {current ? (
                    <span className="block rounded-md border border-zinc-700 px-3 py-1.5 text-center text-xs font-medium text-zinc-500">
                      Current plan
                    </span>
                  ) : tier.id === "free" ? null : (
                    <form action={upgradeAction}>
                      <input type="hidden" name="plan" value={tier.id} />
                      <button
                        type="submit"
                        className="w-full rounded-md bg-orange-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition-colors hover:bg-orange-400"
                      >
                        Upgrade to {tier.name}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {plan !== "free" ? (
          <form action={portalAction} className="mt-3">
            <button type="submit" className="text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-300">
              Manage billing via Polar portal
            </button>
          </form>
        ) : null}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Request an API
        </h2>
        <form
          action={requestVendorAction}
          className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-zinc-400">
              API vendor name
              <input
                name="vendor_name"
                required
                placeholder="e.g. Notion"
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none"
              />
            </label>
            <label className="block text-xs text-zinc-400">
              Spec or docs URL (if you know it)
              <input
                name="spec_or_docs_url"
                type="url"
                placeholder="https://raw.githubusercontent.com/…/openapi.yaml"
                className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none"
              />
            </label>
          </div>
          <label className="block text-xs text-zinc-400">
            Why do you depend on it? (optional)
            <textarea
              name="note"
              rows={2}
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 focus:border-orange-500 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-orange-600 hover:text-orange-300"
          >
            Send request
          </button>
        </form>
      </section>
    </div>
  );
}
