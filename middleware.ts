/**
 * middleware.ts — Edge Authentication Gate & Distributed Cost Guard for `/api/*`
 *
 * Security Policies:
 * 1. Public Routes:
 *    - `/api/auth/**` (authentication, session check, logout)
 *    - `/api/location` (public reverse-geocoding/location resolution)
 *    - `/api/resume/templates` (static resume template definitions)
 *    - `/api/speech/providers` (publicly available speech provider list)
 *    - `/api/profile/anonymous` (guest anonymous profile initialization)
 *    - `/api/assistant/chat` (accessible from landing/login for blind users; strictly IP rate-limited)
 *
 * 2. Protected Routes:
 *    - All other `/api/*` endpoints require a cryptographically signed, unexpired `cf_session` HMAC token.
 *    - Unsigned / forged cookies (e.g. plain email) return immediate HTTP 401 Unauthorized.
 *
 * 3. Rate Limiting:
 *    - Distinct token-bucket policies per category (AI, Audio STT, Audio TTS, Email/Job-Alert, Auth).
 *    - Authenticated users are throttled by verified userId; anonymous callers by IP.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifySessionTokenEdge } from "@/lib/security/sessionEdge";
import {
  checkRateLimit,
  getClientIp,
  buildRateLimitKey,
  RATE_LIMIT_POLICIES,
} from "@/lib/security/rateLimit";

const PUBLIC_API_ROUTES = new Set<string>([
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/session",
  "/api/location",
  "/api/resume/templates",
  "/api/speech/providers",
  "/api/profile/anonymous",
]);

// Assistant is reachable from signed-out login screen for accessibility voice help, but hard rate-limited
const PUBLIC_ACCESSIBILITY_POSTS = new Set<string>([
  "/api/assistant/chat",
]);

const AI_ROUTES = new Set<string>([
  "/api/chat",
  "/api/assistant/chat",
  "/api/resume/analyze",
  "/api/resume/optimize",
]);

const STT_ROUTES = new Set<string>([
  "/api/speech/transcribe",
  "/api/audio/transcribe",
]);

const TTS_ROUTES = new Set<string>([
  "/api/speech/synthesize",
  "/api/audio/synthesize",
]);

const EMAIL_ROUTES = new Set<string>([
  "/api/jobs/alert",
]);

function tooMany(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    {
      code: "RATE_LIMITED",
      message: "Rate limit exceeded. Please slow down and try again shortly.",
      retryAfterSec,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, retryAfterSec)),
        "X-RateLimit-Reset": String(Date.now() + retryAfterSec * 1000),
      },
    }
  );
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;
  const ip = getClientIp(req);

  // 1. Identity / Auth endpoints — always open to negotiate credentials
  if (pathname.startsWith("/api/auth/") || PUBLIC_API_ROUTES.has(pathname)) {
    return NextResponse.next();
  }

  // 2. Extract and verify session token
  const sessionCookie = req.cookies.get("cf_session")?.value?.trim() || "";
  const legacyCookie = req.cookies.get("cf_uid")?.value?.trim() || "";
  const tokenCandidate = sessionCookie || legacyCookie;

  const sessionPayload = tokenCandidate ? await verifySessionTokenEdge(tokenCandidate) : null;
  const verifiedUserId = sessionPayload?.userId || null;

  // 3. Anonymous login-screen voice assistance
  if (!sessionPayload && PUBLIC_ACCESSIBILITY_POSTS.has(pathname)) {
    const anonKey = buildRateLimitKey("AI_ANON", { ip });
    const limitResult = checkRateLimit(anonKey, { limit: 12, windowMs: 60 * 1000 });
    if (limitResult.isLimited) {
      return tooMany(Math.ceil(limitResult.resetInMs / 1000));
    }
    return NextResponse.next();
  }

  // 4. Enforce strict session requirement for all other /api/* endpoints
  if (!sessionPayload) {
    return NextResponse.json(
      {
        code: "UNAUTHORIZED",
        message: "Authentication required. A cryptographically signed session token is mandatory.",
      },
      { status: 401 }
    );
  }

  // 5. Authenticated rate limiting by verified user identity
  if (EMAIL_ROUTES.has(pathname)) {
    const key = buildRateLimitKey("JOB_ALERT", { userId: verifiedUserId, ip });
    const result = checkRateLimit(key, RATE_LIMIT_POLICIES.JOB_ALERT);
    if (result.isLimited) return tooMany(Math.ceil(result.resetInMs / 1000));
  } else if (STT_ROUTES.has(pathname)) {
    const key = buildRateLimitKey("STT", { userId: verifiedUserId, ip });
    const result = checkRateLimit(key, RATE_LIMIT_POLICIES.STT);
    if (result.isLimited) return tooMany(Math.ceil(result.resetInMs / 1000));
  } else if (TTS_ROUTES.has(pathname)) {
    const key = buildRateLimitKey("TTS", { userId: verifiedUserId, ip });
    const result = checkRateLimit(key, RATE_LIMIT_POLICIES.TTS);
    if (result.isLimited) return tooMany(Math.ceil(result.resetInMs / 1000));
  } else if (AI_ROUTES.has(pathname)) {
    const key = buildRateLimitKey("AI_CHAT", { userId: verifiedUserId, ip });
    const result = checkRateLimit(key, RATE_LIMIT_POLICIES.AI_CHAT);
    if (result.isLimited) return tooMany(Math.ceil(result.resetInMs / 1000));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
