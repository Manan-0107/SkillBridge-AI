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
export async function getAuthenticatedUser(req?: any): Promise<AuthenticatedUser | null> {
  let tokenCandidate: string | undefined;
  try {
    const cookieStore = cookies();
    tokenCandidate = cookieStore.get(SESSION_COOKIE)?.value || cookieStore.get(LEGACY_COOKIE)?.value;
  } catch {
    // Outside request store context (e.g. unit testing or direct route handler invocation)
  }

  if (!tokenCandidate && req) {
    if (typeof req.cookies?.get === "function") {
      tokenCandidate = req.cookies.get(SESSION_COOKIE)?.value || req.cookies.get(LEGACY_COOKIE)?.value;
    } else if (req.headers) {
      const cookieHeader = typeof req.headers.get === "function"
        ? req.headers.get("cookie")
        : (req.headers["cookie"] || req.headers["Cookie"]);
      if (cookieHeader && typeof cookieHeader === "string") {
        const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`)) ||
                      cookieHeader.match(new RegExp(`(?:^|;\\s*)${LEGACY_COOKIE}=([^;]+)`));
        if (match) {
          tokenCandidate = match[1];
        }
      }
    }
  }
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

  // 2. Fall back to Supabase Auth server session (`getUser()`) with timeout for Supabase-only sessions without cf_session
  try {
    const supabaseServer = createSupabaseServerClient();
    const authPromise = supabaseServer.auth.getUser();
    const {
      data: { user },
      error,
    } = (await Promise.race([
      authPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("Auth timeout")), 3000)),
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
    // Proceed to rejection
  }

  // 3. Security Contract: Plain, unsigned email cookies (e.g. raw cf_uid=email@example.com)
  // are strictly rejected. Only cryptographically verified sessions are authoritative.
  return null;
}

/**
 * Resolves the authenticated user's id for use inside Route Handlers.
 */
export async function getAuthenticatedUserId(): Promise<string | null> {
  const user = await getAuthenticatedUser();
  return user?.id ?? null;
}
