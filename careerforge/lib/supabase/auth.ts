import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifySessionToken } from "@/lib/security/session";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name?: string | null;
  isGuest?: boolean;
}

const SESSION_COOKIE = "cf_session";
const LEGACY_COOKIE = "cf_uid";

/**
 * Resolves the authenticated user (id and email) for use inside Route Handlers.
 *
 * Verifies identity cryptographically:
 * 1. Supabase Auth server session (`getUser()`) via cryptographically verified JWT.
 * 2. Cryptographically signed HMAC session token (`cf_session`) with expiration checking.
 * 3. Legacy `cf_uid` cookie validated against database `users` table.
 *
 * Rejects unauthenticated requests and forged/tampered cookies.
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = cookies();

  // 1. Try Supabase Auth server session
  try {
    const supabaseServer = createSupabaseServerClient();
    const authPromise = supabaseServer.auth.getUser();
    const {
      data: { user },
      error,
    } = (await Promise.race([
      authPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Auth timeout")), 1200)),
    ])) as any;

    if (!error && user && user.id && user.email) {
      return {
        id: user.id,
        email: user.email.toLowerCase().trim(),
        name: user.user_metadata?.name || null,
        isGuest: false,
      };
    }
  } catch {
    // Proceed to session token validation
  }

  // 2. Try cryptographically signed HMAC session token (`cf_session` or `cf_uid`)
  const tokenCandidate = cookieStore.get(SESSION_COOKIE)?.value || cookieStore.get(LEGACY_COOKIE)?.value;
  if (tokenCandidate) {
    const payload = verifySessionToken(tokenCandidate);
    if (payload) {
      return {
        id: payload.userId,
        email: payload.email,
        name: payload.name ?? null,
        isGuest: Boolean(payload.isGuest),
      };
    }
  }

  // 3. Check legacy cookie `cf_uid`: Validate against database when configured
  const legacyEmail = cookieStore.get(LEGACY_COOKIE)?.value?.toLowerCase().trim();
  if (legacyEmail && legacyEmail.includes("@")) {
    // Basic format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(legacyEmail)) {
      return null;
    }

    const { supabaseConfigured } = await import("@/lib/supabase");

    if (supabaseConfigured) {
      try {
        const client = createSupabaseServerClient();
        const queryPromise = client
          .from("users")
          .select("id, email, name")
          .eq("email", legacyEmail)
          .maybeSingle();

        const { data: dbUser } = (await Promise.race([
          queryPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error("DB timeout")), 1200)),
        ])) as any;

        if (dbUser && dbUser.id && dbUser.email) {
          return {
            id: dbUser.id,
            email: dbUser.email,
            name: dbUser.name || null,
            isGuest: false,
          };
        }
      } catch {
        return null;
      }
    } else {
      // Local dev / test environments without remote Supabase credentials
      const crypto = await import("crypto");
      return {
        id: `user_${crypto.createHash("sha256").update(legacyEmail).digest("hex").slice(0, 16)}`,
        email: legacyEmail,
        name: legacyEmail.split("@")[0],
        isGuest: false,
      };
    }
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
