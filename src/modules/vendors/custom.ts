import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { discoverSource, type FetchBody } from "@/engine/probe";
import type { SourceKind } from "@/engine/types";

/**
 * Custom (private) vendors: the "any API" onboarding path.
 *
 * A user pastes any URL — spec file, docs page, or homepage. We discover
 * the best watchable source for it (see engine/probe), create a private
 * vendor row owned by that user, and watch it for them. The engine then
 * polls it exactly like a catalog vendor; only the owner ever sees it.
 */

export interface CustomVendorResult {
  vendorId: string;
  slug: string;
  name: string;
  watchedUrl: string;
  kind: SourceKind;
}

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "api"
  );
}

function githubRepoOf(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname !== "github.com") return null;
    const parts = u.pathname.split("/").filter(Boolean);
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
  } catch {
    return null;
  }
}

export async function createCustomVendor(
  db: SupabaseClient,
  userId: string,
  input: { url: string; name?: string },
  fetchBody?: FetchBody,
): Promise<CustomVendorResult> {
  let parsed: URL;
  try {
    parsed = new URL(input.url);
  } catch {
    throw new Error("That doesn't look like a valid URL.");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Only http(s) URLs can be watched.");
  }

  const discovered = await discoverSource(parsed.toString(), fetchBody);
  if (!discovered) {
    throw new Error(
      "Nothing watchable was found at that URL. Try linking directly to a spec file, schema, or docs page.",
    );
  }

  const name =
    input.name?.trim().slice(0, 80) ||
    discovered.title?.slice(0, 80) ||
    parsed.hostname.replace(/^www\./, "");

  // Slug: unique per owner, stable per URL (re-adding the same API is a no-op find).
  const urlHash = createHash("sha256").update(discovered.url).digest("hex").slice(0, 8);
  const ownerHash = createHash("sha256").update(userId).digest("hex").slice(0, 6);
  const slug = `custom-${ownerHash}-${slugify(name)}-${urlHash}`;

  const repo = githubRepoOf(parsed.toString());
  const changelog = repo
    ? { type: "github-releases" as const, url: repo }
    : { type: "none" as const };

  const { data, error } = await db
    .from("vendors")
    .upsert(
      {
        slug,
        name,
        homepage: parsed.origin,
        spec_url: discovered.url,
        spec_format: discovered.kind,
        source_kind: discovered.kind,
        visibility: "private",
        owner_user_id: userId,
        changelog,
        poll_interval_minutes: 120,
        poll_offset_minutes: 0,
        next_poll_at: new Date().toISOString(),
      },
      { onConflict: "slug" },
    )
    .select("id, slug, name")
    .single();
  if (error) throw new Error(`Could not save this API: ${error.message}`);
  const vendor = data as { id: string; slug: string; name: string };

  const { error: watchError } = await db
    .from("watchlist")
    .upsert({ user_id: userId, vendor_id: vendor.id }, { onConflict: "user_id,vendor_id" });
  if (watchError) throw new Error(`Saved, but watching failed: ${watchError.message}`);

  return {
    vendorId: vendor.id,
    slug: vendor.slug,
    name: vendor.name,
    watchedUrl: discovered.url,
    kind: discovered.kind,
  };
}
