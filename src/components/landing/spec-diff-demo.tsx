"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const STEP_MS = 2600;
const TOTAL_STEPS = 4;

function subscribeToReducedMotion(onChange: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

const SPEC_LINES = [
  { n: 1, text: "openapi: 3.1.0", cls: "text-zinc-500" },
  { n: 2, text: "paths:", cls: "text-sky-300" },
  { n: 3, text: "  /v1/payment_intents:", cls: "text-zinc-300" },
  { n: 4, text: "    post:", cls: "text-sky-300" },
  { n: 5, text: "      summary: Create a payment intent", cls: "text-zinc-400" },
  { n: 6, text: "      parameters:", cls: "text-sky-300" },
  { n: 7, text: "        - name: amount", cls: "text-zinc-400" },
];

function SpecLine({ n, text, cls }: { n: number; text: string; cls: string }) {
  return (
    <div className="flex whitespace-pre">
      <span className="w-6 shrink-0 select-none pr-2 text-right text-zinc-700">{n}</span>
      <span className={cls}>{text}</span>
    </div>
  );
}

export function SpecDiffDemo() {
  const reduced = usePrefersReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setStep((s) => (s + 1) % TOTAL_STEPS), STEP_MS);
    return () => clearInterval(id);
  }, [reduced]);

  const current = reduced ? TOTAL_STEPS - 1 : step;
  const showDiff = current >= 1;
  const showBadge = current >= 2;
  const showAlert = current >= 3;

  const transition = "transition-all duration-700 ease-out";

  return (
    <div className="relative">
      {/* midground: the spec panel */}
      <div
        className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/90 shadow-2xl shadow-black/60"
        style={{ transform: "perspective(1200px) rotateY(-4deg) rotateX(2deg)" }}
      >
        {/* window chrome */}
        <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-zinc-700" />
          <span className="size-2.5 rounded-full bg-zinc-700" />
          <span className="size-2.5 rounded-full bg-zinc-700" />
          <span className="ml-2 font-mono text-[11px] text-zinc-500">
            stripe/openapi-spec3.yaml
          </span>
          {/* status pill */}
          <span
            className={`ml-auto flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] ${transition} ${
              current === 0
                ? "border-emerald-900/60 bg-emerald-950/50 text-emerald-400"
                : "border-amber-900/60 bg-amber-950/50 text-amber-300"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${
                current === 0 ? "bg-emerald-400" : "bg-amber-400"
              } ${reduced ? "" : "animate-[blink_1.4s_ease-in-out_infinite]"}`}
            />
            {current === 0 ? "watching · poll #418" : "change detected"}
          </span>
        </div>

        {/* spec body */}
        <div className="space-y-1 p-4 font-mono text-[12.5px] leading-5">
          {SPEC_LINES.map((line) => (
            <SpecLine key={line.n} {...line} />
          ))}

          {/* the diff */}
          <div
            className={`overflow-hidden ${transition} ${
              showDiff ? "max-h-20 opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="rounded-md border border-red-900/50 bg-red-950/30">
              <div className="flex px-1">
                <span className="w-6 shrink-0 select-none pr-2 text-right text-zinc-700">8</span>
                <span className="whitespace-pre text-red-300">
                  {"      required: [amount]"}
                </span>
                <span className="pl-2 font-sans text-[10px] text-red-500/80">- removed</span>
              </div>
            </div>
            <div className="mt-1 rounded-md border border-orange-900/50 bg-orange-950/30">
              <div className="flex px-1">
                <span className="w-6 shrink-0 select-none pr-2 text-right text-zinc-700">9</span>
                <span className="whitespace-pre text-orange-200">
                  {"      required: [amount, customer]"}
                </span>
                <span className="pl-2 font-sans text-[10px] text-orange-500/80">+ added</span>
              </div>
            </div>
          </div>

          <SpecLine n={10} text="        - name: customer" cls="text-zinc-400" />
          <div className="flex">
            <span className="w-6 shrink-0 pr-2 text-right text-zinc-700">11</span>
            <span className="inline-block h-4 w-1.5 bg-orange-400/80" />
          </div>
        </div>
      </div>

      {/* foreground: breaking badge */}
      <div
        className={`absolute -right-3 top-16 rounded-lg border border-red-800 bg-red-950/90 px-3 py-2 shadow-xl shadow-black/50 backdrop-blur ${transition} ${
          showBadge
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-3 opacity-0"
        }`}
      >
        <p className="font-mono text-[10px] uppercase tracking-widest text-red-400">severity</p>
        <p className="text-xs font-semibold text-red-200">BREAKING</p>
      </div>

      {/* foreground: plain-English alert card */}
      <div
        className={`absolute -bottom-10 -left-4 w-[88%] rounded-xl border border-zinc-700 bg-zinc-900/95 p-4 shadow-2xl shadow-black/70 backdrop-blur sm:-left-10 sm:w-72 ${transition} ${
          showAlert
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-4 opacity-0"
        }`}
      >
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
          <span className="rounded bg-red-950/80 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-red-400">
            breaking
          </span>
          <span className="font-mono text-[10px] text-zinc-500">stripe · 4 min ago</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-zinc-200">
          Creating a payment intent now requires a <code className="rounded bg-zinc-800 px-1 font-mono text-[10px] text-orange-300">customer</code>{" "}
          ID. Calls without one will start failing.
        </p>
      </div>
    </div>
  );
}
