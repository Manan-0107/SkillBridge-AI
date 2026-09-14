import { createBrowserClient } from "@supabase/ssr";

/**
 * Creates a Supabase client for use in Client Components. Safe to call
 * repeatedly (e.g. inside a `useMemo`) — `@supabase/ssr` reuses the
 * underlying auth storage.
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";
  return createBrowserClient(url, key);
}
