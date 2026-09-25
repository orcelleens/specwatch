import Link from "next/link";
import { ArrowRight, Bell, Check, Eye, FileDiff, ScanSearch } from "lucide-react";
import { SpecDiffDemo } from "@/components/landing/spec-diff-demo";

export const metadata = {
  title: "Know before it breaks",
  description:
    "SpecWatch watches the OpenAPI specs of the APIs you depend on and tells you, in plain English, the moment a change will break your code.",
};

const WATCHED = [
  "Stripe",
  "GitHub",
  "OpenAI",
  "Twilio",
  "Slack",
  "Supabase",
  "Cloudflare",
  "Square",
  "Plaid",
];

const OLD_WAY = [
  {
    title: "The unsubscribe",
    body: "The vendor has a changelog. It has an RSS feed. You meant to read it. You don't.",
  },
  {
    title: "The 2 a.m. alert",
    body: "Your error tracker tells you first — after the 500s reach your users, in production.",
  },
  {
    title: "The Reddit thread",
    body: "Three days later you find the forum post explaining what changed and why it broke you.",
  },
];

const ENGINE_STEPS = [
  {
    icon: Eye,
    title: "Watch",
    body: "We poll the public OpenAPI spec of every API you watch, every 10 minutes, with conditional requests. No vendor cooperation needed.",
  },
  {
    icon: FileDiff,
    title: "Diff",
    body: "Each spec is normalized — refs resolved, volatile noise stripped — then deep-diffed against the last known-good snapshot, semantically.",
  },
  {
    icon: ScanSearch,
    title: "Classify",
    body: "Deterministic rules assign severity: a removed endpoint or newly-required parameter is breaking. AI translates each diff into plain English.",
  },
  {
    icon: Bell,
    title: "Alert",
    body: "Within minutes, you get an email and Slack message that says what changed, where, and what will break — not a wall of JSON.",
  },
];

const PLANS = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    features: ["Watch 3 APIs", "Weekly digest email", "Public change feed"],
    cta: "Start free",
    featured: false,
  },
  {
    name: "Pro",
    price: "$19",
    cadence: "/month",
    features: ["Unlimited APIs", "Within-minutes email alerts", "Slack alerts", "Breaking-change-only filter"],
    cta: "Get alerts in minutes",
    featured: true,
  },
  {
    name: "Team",
    price: "$49",
    cadence: "/month",
    features: ["Everything in Pro", "Shared watchlist", "Per-vendor Slack routing"],
    cta: "Watch as a team",
    featured: false,
  },
];

export default function LandingPage() {
  return (
    <main className="relative overflow-hidden">
      {/* background plane */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[800px] bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(249,115,22,0.13),transparent),radial-gradient(ellipse_40%_35%_at_80%_10%,rgba(56,189,248,0.06),transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,black,transparent)]"
      />

      {/* nav */}
      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="text-[15px] font-bold tracking-tight">SpecWatch</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/changes" className="hidden text-zinc-400 transition-colors hover:text-zinc-100 sm:block">
            Live changes
          </Link>
          <Link
            href="/dashboard"
            className="rounded-md bg-orange-500 px-3.5 py-1.5 text-xs font-semibold text-zinc-950 transition-all hover:bg-orange-400 active:scale-[0.98]"
          >
            Start free
          </Link>
        </nav>
      </header>

      {/* Act 1 — the hook */}
      <section className="relative mx-auto grid w-full max-w-6xl gap-16 px-6 pb-28 pt-16 sm:pt-24 lg:grid-cols-[1.05fr_1fr] lg:items-center">
        <div>
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-xs text-zinc-400">
            <span className="size-1.5 rounded-full bg-orange-400" />
            Dependabot, but for the APIs you call
          </p>
          <h1 className="text-4xl font-bold leading-[1.06] tracking-tight sm:text-6xl">
            Know before
            <br />
            it <span className="text-orange-400">breaks.</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-zinc-400 sm:text-lg">
            The APIs you build on change without asking you. SpecWatch watches their OpenAPI
            specs continuously and tells you — in plain English — the moment a change will
            break your code. Not a 500 at 2 a.m. A heads-up in minutes.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/dashboard"
              className="group flex items-center gap-2 rounded-md bg-orange-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-orange-950/50 transition-all hover:bg-orange-400 active:scale-[0.98]"
            >
              Watch your first API free
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/changes"
              className="rounded-md border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100"
            >
              See the live feed
            </Link>
          </div>
          <p className="mt-6 text-xs text-zinc-600">
            Stripe · GitHub · OpenAI · Twilio · Slack · Supabase · Cloudflare · Square · Plaid —
            watched from day one. No credit card.
          </p>
        </div>

        <div className="lg:pb-12">
          <SpecDiffDemo />
        </div>
      </section>

      {/* Act 2 — the friction */}
      <section className="relative border-t border-zinc-900 bg-zinc-950/80">
        <div className="mx-auto w-full max-w-6xl px-6 py-24">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-600">The old way</p>
          <h2 className="mt-3 max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">
            You find out an API changed when your users find out.
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {OLD_WAY.map((card) => (
              <div
                key={card.title}
                className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5"
              >
                <h3 className="text-sm font-semibold text-zinc-200">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">{card.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 max-w-2xl border-l-2 border-orange-600/70 pl-4 text-sm leading-relaxed text-zinc-400">
            YC reports that <span className="text-zinc-200">30% of AWS downtime</span> traced back
            to unnoticed changes in external APIs and packages. The spec was public the whole
            time. Nobody was reading it.
          </p>
        </div>
      </section>

      {/* Act 3 — the shift */}
      <section className="relative border-t border-zinc-900">
        <div className="mx-auto w-full max-w-6xl px-6 py-24">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-600">The shift</p>
          <h2 className="mt-3 max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">
            A raw diff tells you <em className="text-zinc-500">what</em> moved.
            <br />
            SpecWatch tells you what it <span className="text-orange-400">means</span>.
          </h2>
          <div className="mt-10 grid items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
            <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 p-4 font-mono text-[11px] leading-5 text-zinc-500">
              <p className="text-zinc-600">- paths./charges.post.parameters[4]</p>
              <p className="text-zinc-600">- required: [amount]</p>
              <p className="text-emerald-500/70">+ required: [amount, customer]</p>
              <p className="text-zinc-600">- components.Charge.currency: string</p>
              <p className="text-emerald-500/70">+ components.Charge.currency: enum</p>
              <p className="mt-3 text-zinc-700">
                {"// 400 lines like this, per release, per API"}
              </p>
            </div>
            <div className="flex justify-center">
              <div className="flex size-11 items-center justify-center rounded-full border border-orange-700/60 bg-orange-950/50">
                <ArrowRight className="text-orange-400" size={18} />
              </div>
            </div>
            <div className="rounded-lg border border-orange-800/60 bg-zinc-900/80 p-5">
              <div className="flex items-center gap-2">
                <span className="rounded bg-red-950/80 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-red-400">
                  breaking
                </span>
                <span className="font-mono text-[10px] text-zinc-500">stripe · 4 min ago</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-zinc-200">
                Creating a payment intent now requires a{" "}
                <code className="rounded bg-zinc-800 px-1 font-mono text-xs text-orange-300">customer</code>{" "}
                ID, and <span className="font-mono text-xs text-orange-300">currency</span> now
                only accepts a fixed set of values. Update your checkout calls before the next
                release rolls out.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Act 4 — the engine */}
      <section className="relative border-t border-zinc-900 bg-zinc-950/80">
        <div className="mx-auto w-full max-w-6xl px-6 py-24">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-600">The engine</p>
          <h2 className="mt-3 max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">
            Four steps, fully automated, zero vendor setup.
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ENGINE_STEPS.map((step, i) => (
              <div key={step.title} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-5">
                <div className="flex items-center justify-between">
                  <step.icon size={18} className="text-orange-400" />
                  <span className="font-mono text-[10px] text-zinc-600">0{i + 1}</span>
                </div>
                <h3 className="mt-4 text-sm font-semibold text-zinc-100">{step.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">{step.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-sm text-zinc-500">
            Missing an API?{" "}
            <Link href="/dashboard/settings" className="text-orange-400 underline underline-offset-2 hover:text-orange-300">
              Request it
            </Link>{" "}
            — if it publishes an OpenAPI spec, it can be watched. No vendor cooperation required.
          </p>
        </div>
      </section>

      {/* Act 5 — the proof */}
      <section className="relative border-t border-zinc-900">
        <div className="mx-auto w-full max-w-6xl px-6 py-24">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-600">The proof</p>
          <h2 className="mt-3 max-w-2xl text-2xl font-bold tracking-tight sm:text-3xl">
            Watched from day one. Every catch is public.
          </h2>
          <div className="mt-10 flex flex-wrap gap-2">
            {WATCHED.map((name) => (
              <span
                key={name}
                className="rounded-full border border-zinc-800 bg-zinc-900/60 px-3.5 py-1.5 text-xs font-medium text-zinc-300"
              >
                {name}
              </span>
            ))}
          </div>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Every change the engine catches lands on the{" "}
            <Link href="/changes" className="text-orange-400 underline underline-offset-2 hover:text-orange-300">
              public feed
            </Link>{" "}
            — the same detections paying users get alerted on. Watch it fill up in real time; that
            is the product working.
          </p>
        </div>
      </section>

      {/* Act 6 — pricing + climax */}
      <section className="relative border-t border-zinc-900 bg-zinc-950/80">
        <div className="mx-auto w-full max-w-6xl px-6 py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-600">Pricing</p>
            <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              Less than one hour of downtime.
            </h2>
            <p className="mt-3 text-sm text-zinc-500">
              Start free, upgrade when you want alerts in minutes instead of a weekly digest.
              Cancel in one click.
            </p>
          </div>
          <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-xl border p-6 ${
                  plan.featured
                    ? "border-orange-600/70 bg-zinc-900 shadow-xl shadow-orange-950/30"
                    : "border-zinc-800 bg-zinc-900/40"
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-semibold">{plan.name}</span>
                  <span className="text-lg font-bold">
                    {plan.price}
                    <span className="text-xs font-normal text-zinc-500"> {plan.cadence}</span>
                  </span>
                </div>
                <ul className="mt-4 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-xs text-zinc-400">
                      <Check size={12} className="mt-0.5 shrink-0 text-emerald-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/dashboard"
                  className={`mt-5 block rounded-md px-4 py-2 text-center text-xs font-semibold transition-all active:scale-[0.98] ${
                    plan.featured
                      ? "bg-orange-500 text-zinc-950 hover:bg-orange-400"
                      : "border border-zinc-700 text-zinc-300 hover:border-zinc-500"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-xs text-zinc-600">
            Free forever for 3 APIs. Paid plans billed via Polar, cancel anytime.
          </p>
        </div>
      </section>

      {/* footer */}
      <footer className="border-t border-zinc-900">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-xs text-zinc-600">
          <Link href="/" className="flex items-center gap-2">
            <Logo />
            <span className="font-semibold text-zinc-400">SpecWatch</span>
          </Link>
          <div className="flex gap-5">
            <Link href="/changes" className="transition-colors hover:text-zinc-300">Live changes</Link>
            <Link href="/dashboard" className="transition-colors hover:text-zinc-300">Sign in</Link>
          </div>
          <p>Built by a solo dev who got burned by an API change one time too many.</p>
        </div>
      </footer>
    </main>
  );
}

function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="14" fill="#18181b" stroke="#3f3f46" strokeWidth="2" />
      <rect x="14" y="16" width="22" height="8" rx="4" fill="#71717a" />
      <rect x="14" y="28" width="32" height="8" rx="4" fill="#ef4444" opacity="0.85" />
      <rect x="14" y="40" width="24" height="8" rx="4" fill="#f97316" />
    </svg>
  );
}
