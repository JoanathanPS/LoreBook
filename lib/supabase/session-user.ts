import type { SupabaseClient } from "@supabase/supabase-js";

export interface SessionUser {
  id: string;
  email: string | null;
}

/**
 * Identity for read-only page renders.
 *
 * `auth.getUser()` is a network round trip to Supabase Auth on every call.
 * `auth.getClaims()` verifies the session JWT signature instead: locally via
 * the cached JWKS when the project uses asymmetric signing keys, and falling
 * back to the Auth server otherwise. Either way the identity is verified, so
 * it is safe for RLS-scoped page reads. Mutations still use getUser().
 */
export async function getSessionUser(supabase: SupabaseClient): Promise<SessionUser | null> {
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
}
