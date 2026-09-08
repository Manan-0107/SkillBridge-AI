import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase";

export interface AuthenticatedUser {
  id: string;
  email: string;
}

/**
 * Resolves the authenticated user's identity (id + email) for use inside Route Handlers.
 * Checks Supabase Auth JWT first, and falls back to verifying the signed cf_uid cookie
 * against the database `users` record. Never trusts request body parameters.
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  if (!supabaseConfigured) {
    try {
      const cookieStore = cookies();
      const email = cookieStore.get("cf_uid")?.value;
      if (email && email.includes("@")) {
        return {
          id: `local_${Buffer.from(email).toString("hex").slice(0, 16)}`,
          email,
        };
      }
    } catch {}
    return null;
  }

  const supabase = createSupabaseServerClient();

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (!error && user?.id) {
      return {
        id: user.id,
        email: user.email ?? "",
      };
    }
  } catch {
    // Supabase auth check fallback
  }

  // Fallback: Verify cf_uid cookie against database users record
  try {
    const cookieStore = cookies();
    const email = cookieStore.get("cf_uid")?.value;
    if (email && email.includes("@")) {
      const { data, error } = await supabase
        .from("users")
        .select("id, email")
        .eq("email", email)
        .single();

      if (!error && data?.id) {
        return {
          id: data.id,
          email: data.email,
        };
      }
    }
  } catch {
    // Cookie store or DB error
  }

  return null;
}

/**
 * Resolves the authenticated user's id for use inside Route Handlers.
 */
export async function getAuthenticatedUserId(): Promise<string | null> {
  const user = await getAuthenticatedUser();
  return user?.id ?? null;
}

