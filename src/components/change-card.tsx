import Link from "next/link";
import { SeverityBadge } from "./severity-badge";

export interface ChangeCardData {
  id: string;
  vendorSlug: string;
  vendorName: string;
  jsonPath: string;
  kind: string;
  severity: "breaking" | "deprecation" | "feature" | "docs";
  summary: string | null;
  impactHint: string | null;
  detectedAt: string;
}

export function ChangeCard({ change }: { change: ChangeCardData }) {
  const date = new Date(change.detectedAt);
  return (
    <article className="group relative overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,_transparent,_rgba(15,23,42,0.05))] pointer-events-none" />
      <div className="relative z-10">
        <div className="flex flex-wrap items-center gap-3 mb-3 py-2 px-3 bg-zinc-900/50 rounded-lg">
          <SeverityBadge severity={change.severity} className="px-3 py-1 text-sm" />
          <div className="flex-1 min-w-0">
            <Link
              href={`/vendors/${change.vendorSlug}`}
              className="block font-semibold text-zinc-100 hover:text-orange-400 transition-colors duration-200 group-hover:text-orange-300"
            >
              {change.vendorName}
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <code className="rounded bg-zinc-800/60 px-2 py-0.5 text-[11px] text-zinc-400">
                {change.jsonPath}
              </code>
              <time dateTime={change.detectedAt} className="ml-auto text-[11px]">
                {date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </time>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {change.summary ? (
            <p className="text-sm leading-relaxed text-zinc-200">{change.summary}</p>
          ) : (
            <p className="text-sm text-zinc-400 italic">{change.kind}</p>
          )}
          {change.impactHint ? (
            <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">{change.impactHint}</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
