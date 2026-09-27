import type { Severity } from "@/engine/types";

const STYLES: Record<Severity, { label: string; className: string }> = {
  breaking: { label: "Breaking", className: "bg-red-950 text-red-300 border-red-800" },
  deprecation: { label: "Deprecation", className: "bg-amber-950 text-amber-300 border-amber-800" },
  feature: { label: "New", className: "bg-emerald-950 text-emerald-300 border-emerald-800" },
  docs: { label: "Docs", className: "bg-zinc-800 text-zinc-400 border-zinc-700" },
};

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  const style = STYLES[severity] ?? STYLES.docs;
  return (
    <span
      className={`inline-flex items-center rounded border px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider gap-1.5 ${style.className} ${className ?? ""}`}
    >
      <div className={`h-3 w-3 ${style.className.split(" ")[0]} rounded`} />
      <span>{style.label}</span>
    </span>
  );
}
