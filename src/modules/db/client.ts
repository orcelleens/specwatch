import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { identityFetch } from "@/lib/identity-fetch";

let cached: SupabaseClient | null = null;

/**
 * Server-only Supabase client using the service role key.
 * The service role bypasses RLS; every caller must scope queries by the
 * Supabase-authenticated user id.
 * Never import this module from client components.
 */
export function serviceClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: identityFetch },
  });
  return cached;
}
