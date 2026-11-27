import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for trusted server-side work, such as the
 * ingest worker. It bypasses RLS, so never import it from client code, and
 * never use it to act on input you haven't checked belongs to the user.
 */
let cached: SupabaseClient | null = null;

export class AdminConfigError extends Error {
  override name = "AdminConfigError";
}

export function createAdminClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new AdminConfigError(
      "SUPABASE_SERVICE_ROLE_KEY is not set, so the ingest worker cannot run. " +
        "Add it to the deployment's environment variables and redeploy.",
    );
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return cached;
}

export function hasAdminConfig(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}
