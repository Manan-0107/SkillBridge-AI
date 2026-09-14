import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Resolves the authenticated user's id for use inside Route Handlers.
 *
 * Uses `supabase.auth.getUser()` rather than `getSession()` — `getUser()`
 * revalidates the JWT against the Supabase Auth server on every call, so it
 * can't be spoofed by a tampered/stale cookie the way a locally-decoded
 * session can. That matters here specifically: `requiresTextFallback` gates
 * an accessibility guarantee, so the identity check backing it should be as
 * strong as the one backing any other write.
 */
export async function getAuthenticatedUserId(): Promise<string | null> {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return user.id;
}
