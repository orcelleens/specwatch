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
    <article className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 hover:border-zinc-700 transition-colors">
      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
        <SeverityBadge severity={change.severity} />
        <Link
          href={`/vendors/${change.vendorSlug}`}
          className="font-medium text-zinc-300 hover:text-orange-400"
        >
          {change.vendorName}
        </Link>
        <code className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-[11px] text-zinc-400">
          {change.jsonPath}
        </code>
        <time dateTime={change.detectedAt} className="ml-auto">
          {date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
        </time>
      </div>
      {change.summary ? (
        <p className="mt-2.5 text-sm leading-relaxed text-zinc-200">{change.summary}</p>
      ) : (
        <p className="mt-2.5 text-sm text-zinc-400 italic">{change.kind}</p>
      )}
      {change.impactHint ? (
        <p className="mt-1 text-[13px] leading-relaxed text-zinc-500">{change.impactHint}</p>
      ) : null}
    </article>
  );
}
