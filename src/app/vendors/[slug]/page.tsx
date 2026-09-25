import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { serviceClient } from "@/modules/db/client";
import { ChangeCard, type ChangeCardData } from "@/components/change-card";

interface VendorRow {
  id: string;
  slug: string;
  name: string;
  homepage: string | null;
  poll_interval_minutes: number;
  next_poll_at: string;
  last_error: string | null;
  status: string;
}

interface ChangeRow {
  id: string;
  json_path: string;
  kind: string;
  severity: ChangeCardData["severity"];
  summary: string | null;
  impact_hint: string | null;
  detected_at: string;
}

const SEVERITIES = ["all", "breaking", "deprecation", "feature", "docs"] as const;

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return {
    title: `${slug} API changes`,
    description: `Every detected change to the ${slug} API, in plain English — watched continuously by SpecWatch.`,
  };
}

export default async function VendorPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const severity = typeof sp.severity === "string" && sp.severity !== "all" ? sp.severity : null;

  const db = serviceClient();
  const { data: vendorData } = await db
    .from("vendors")
    .select("id, slug, name, homepage, poll_interval_minutes, next_poll_at, last_error, status")
    .eq("slug", slug)
    .maybeSingle();
  if (!vendorData) notFound();
  const vendor = vendorData as VendorRow;

  let query = db
    .from("changes")
    .select("id, json_path, kind, severity, summary, impact_hint, detected_at")
    .eq("vendor_id", vendor.id)
    .order("detected_at", { ascending: false })
    .limit(50);
  if (severity) query = query.eq("severity", severity);
  const { data: changeRows } = await query;
  const changes = (changeRows ?? []) as ChangeRow[];

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-16">
      <nav className="mb-8 text-xs text-zinc-500">
        <Link href="/" className="hover:text-zinc-300">SpecWatch</Link>
        {" / "}
        <Link href="/changes" className="hover:text-zinc-300">API changes</Link>
        {" / "}
        <span className="text-zinc-400">{vendor.name}</span>
      </nav>

      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight">{vendor.name} API changes</h1>
        <p className="mt-2 max-w-xl text-sm text-zinc-500">
          The {vendor.name} OpenAPI spec is polled every {vendor.poll_interval_minutes} minutes.
          Every detected change, translated to plain English.
        </p>
        {vendor.last_error ? (
          <p className="mt-3 flex items-center gap-2 text-xs text-amber-400">
            <AlertTriangle size={13} /> last poll: {vendor.last_error}
          </p>
        ) : null}
      </header>

      <div className="mb-6 flex gap-2 text-xs">
        {SEVERITIES.map((option) => {
          const href = option === "all" ? `/vendors/${slug}` : `/vendors/${slug}?severity=${option}`;
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
          No changes detected {severity ? `of type "${severity}"` : "yet"} — the baseline snapshot
          is being tracked.
        </p>
      ) : (
        <div className="space-y-2.5">
          {changes.map((change) => (
            <ChangeCard
              key={change.id}
              change={{
                id: change.id,
                vendorSlug: vendor.slug,
                vendorName: vendor.name,
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
