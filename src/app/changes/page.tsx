import Link from "next/link";
import { serviceClient } from "@/modules/db/client";
import { ChangeCard, type ChangeCardData } from "@/components/change-card";

interface ChangeRow extends ChangeCardData {
  severity: ChangeCardData["severity"];
}

interface Row {
  id: string;
  json_path: string;
  kind: string;
  severity: ChangeRow["severity"];
  summary: string | null;
  impact_hint: string | null;
  detected_at: string;
  vendors: { slug: string; name: string }[];
}

export const dynamic = "force-dynamic";

export const metadata = {
  title: "API changes, caught and translated",
  description:
    "The public feed of every API spec change SpecWatch has caught, across Stripe, GitHub, OpenAI, Slack and more.",
};

const SEVERITIES = ["all", "breaking", "deprecation", "feature", "docs"] as const;

export default async function ChangesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const severity = typeof sp.severity === "string" && sp.severity !== "all" ? sp.severity : null;

  const db = serviceClient();
  let query = db
    .from("changes")
    .select("id, json_path, kind, severity, summary, impact_hint, detected_at, vendors(slug, name)")
    .order("detected_at", { ascending: false })
    .limit(60);
  if (severity) query = query.eq("severity", severity);
  const { data } = await query;
  const changes = (data ?? []) as Row[];

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-16">
      <nav className="mb-8 text-xs text-zinc-500">
        <Link href="/" className="hover:text-zinc-300">SpecWatch</Link>
        {" / "}
        <span className="text-zinc-400">API changes</span>
      </nav>

      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight">Every API change we caught</h1>
        <p className="mt-2 max-w-xl text-sm text-zinc-500">
          The public timeline across all watched vendors. Watch an API and changes like these land
          in your inbox within minutes.
        </p>
      </header>

      <div className="mb-6 flex gap-2 text-xs">
        {SEVERITIES.map((option) => {
          const href = option === "all" ? "/changes" : `/changes?severity=${option}`;
          const active = option === "all" ? !severity : severity === option;
          return (
            <Link
              key={option}
              href={href}
              className={`rounded-full border px-3 py-1 transition-colors ${
                active
                  ? "border-orange-600 text-orange-300"
                  : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
              }`}
            >
              {option}
            </Link>
          );
        })}
      </div>

      {changes.length === 0 ? (
        <p className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-6 text-sm text-zinc-500">
          No changes recorded yet — the engine is building its baseline snapshots.
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
    </div>
  );
}
