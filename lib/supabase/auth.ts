import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Resolves the authenticated user for the current Route Handler request.
 *
 * Uses `supabase.auth.getUser()` rather than `getSession()` — `getUser()`
 * revalidates the JWT against the Supabase Auth server on every call, so it
 * can't be spoofed by a tampered/stale cookie the way a locally-decoded
 * session can. This is the ONLY trusted identity source for the API; request
 * bodies and unsigned cookies are never trusted (audit finding C1).
 */
export async function getAuthenticatedUser(): Promise<{ id: string; email: string } | null> {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.email) return null;
  return { id: user.id, email: user.email };
}

/** Convenience wrapper — just the verified user id, or null. */
export async function getAuthenticatedUserId(): Promise<string | null> {
  return (await getAuthenticatedUser())?.id ?? null;
}
