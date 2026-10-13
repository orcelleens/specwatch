import { getUser } from "@/lib/clerk-auth";
import { Eye, EyeOff, Globe, Lock, Plus } from "lucide-react";
import { serviceClient } from "@/modules/db/client";
import { FREE_VENDOR_LIMIT, getPlan } from "@/modules/billing/plan";
import { toggleWatchAction } from "@/modules/watchlist/actions";
import { addCustomApiAction } from "@/modules/vendors/actions";

interface VendorRow {
  id: string;
  slug: string;
  name: string;
  homepage: string | null;
  changelog: { type: string };
  poll_interval_minutes: number;
  source_kind: string | null;
  visibility: string | null;
}

export const metadata = { title: "My APIs" };

const KIND_LABEL: Record<string, string> = {
  openapi: "OpenAPI",
  graphql: "GraphQL",
  asyncapi: "AsyncAPI",
  postman: "Postman",
  docs: "Docs page",
  json: "JSON",
  text: "Text/Markdown",
};

export default async function ApisPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getUser();
  if (!user) return null;
  const db = serviceClient();
  const plan = await getPlan(user.id);
  const sp = await searchParams;
  const added = typeof sp.added === "string" ? sp.added : null;
  const addError = typeof sp.addError === "string" ? sp.addError : null;

  const [{ data: vendorRows }, { data: watchRows }] = await Promise.all([
    db
      .from("vendors")
      .select("id, slug, name, homepage, changelog, poll_interval_minutes, source_kind, visibility")
      .or(`visibility.eq.public,owner_user_id.eq.${user.id}`)
      .order("name"),
    db.from("watchlist").select("vendor_id").eq("user_id", user.id),
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

      {/* Add any API — the universal onboarding path */}
      <section className="rounded-lg border border-orange-800/50 bg-zinc-900/60 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
          <Plus size={15} className="text-orange-400" /> Add any API
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
          Paste a spec file, schema, docs page, or homepage URL. SpecWatch detects what it is —
          OpenAPI, GraphQL, AsyncAPI, Postman, generic JSON, or docs-only — finds the watchable
          source, and polls it like any catalog API. Custom APIs are private to you.
        </p>
        {added ? (
          <p className="mt-3 rounded-md border border-emerald-800/60 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300">
            Now watching it as a {KIND_LABEL[added] ?? added} source. First snapshot lands on the
            next poll — changes appear from the second snapshot onward.
          </p>
        ) : null}
        {addError ? (
          <p className="mt-3 rounded-md border border-red-800/60 bg-red-950/30 px-3 py-2 text-xs text-red-300">
            {addError}
          </p>
        ) : null}
        <form action={addCustomApiAction} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            name="url"
            type="url"
            required
            placeholder="https://…/openapi.json, …/docs, or a homepage"
            className="w-full flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none"
          />
          <input
            name="name"
            type="text"
            placeholder="Name (optional)"
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none sm:w-44"
          />
          <button
            type="submit"
            className="shrink-0 rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-orange-400"
          >
            Probe &amp; watch
          </button>
        </form>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        {vendors.map((vendor) => {
          const watched = watchedIds.has(vendor.id);
          const isPrivate = vendor.visibility === "private";
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
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                    <span>
                      polled every {vendor.poll_interval_minutes} min
                      {vendor.changelog?.type && vendor.changelog.type !== "none"
                        ? ` · changelog watched (${vendor.changelog.type})`
                        : ""}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-zinc-700 px-1.5 py-px text-[10px] text-zinc-400">
                      {isPrivate ? <Lock size={9} /> : <Globe size={9} />}
                      {KIND_LABEL[vendor.source_kind ?? "openapi"] ?? "OpenAPI"}
                      {isPrivate ? " · private" : ""}
                    </span>
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
        Want an API in the public catalog for everyone?{" "}
        <a href="/dashboard/settings" className="text-zinc-400 underline underline-offset-2">
          Request it
        </a>{" "}
        — or just add it privately above; any published spec, schema, or docs page can be watched.
      </p>
    </div>
  );
}
