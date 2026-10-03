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
  checkRateLimitAsync,
  getClientIp,
  buildRateLimitKey,
  RATE_LIMIT_POLICIES,
  RateLimitResult,
} from "@/lib/security/rateLimit";
import { getOrGenerateCorrelationId } from "@/lib/observability/correlation";
import { isProductionEnvironment } from "@/lib/security/environment";

const PUBLIC_API_ROUTES = new Set<string>([
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/session",
  "/api/location",
  "/api/resume/templates",
  "/api/speech/providers",
  "/api/profile/anonymous",
  "/api/health/liveness",
  "/api/health/readiness",
]);

// Assistant is reachable from signed-out login screen for accessibility voice help, but hard rate-limited
const PUBLIC_ACCESSIBILITY_POSTS = new Set<string>([
  "/api/assistant/chat",
]);

const AI_ROUTES = new Set<string>([
  "/api/assistant/chat",
  "/api/resume/analyze",
  "/api/resume/optimize",
]);

const STT_ROUTES = new Set<string>([
  "/api/speech/transcribe",
]);

const TTS_ROUTES = new Set<string>([
  "/api/speech/synthesize",
]);

const EMAIL_ROUTES = new Set<string>([
  "/api/jobs/alert",
]);

function withCorrelation(res: NextResponse, correlationId: string): NextResponse {
  res.headers.set("x-correlation-id", correlationId);
  res.headers.set("x-request-id", correlationId);
  return res;
}

function nextWithCorrelation(requestHeaders: Headers, correlationId: string): NextResponse {
  const res = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  res.headers.set("x-correlation-id", correlationId);
  res.headers.set("x-request-id", correlationId);
  return res;
}

function tooMany(
  retryAfterSec: number,
  correlationId: string,
  status = 429,
  code = "RATE_LIMITED",
  message = "Rate limit exceeded. Please slow down and try again shortly."
): NextResponse {
  const res = NextResponse.json(
    {
      code,
      message,
      ...(status === 429 ? { retryAfterSec } : {}),
    },
    {
      status,
      headers: {
        "Retry-After": String(Math.max(1, retryAfterSec)),
        "X-RateLimit-Reset": String(Date.now() + retryAfterSec * 1000),
      },
    }
  );
  return withCorrelation(res, correlationId);
}

function handleRateLimitResult(result: RateLimitResult, correlationId: string): NextResponse | null {
  if (result.isLimited || !result.allowed) {
    if (result.status === 503) {
      return tooMany(60, correlationId, 503, "SERVICE_UNAVAILABLE", "Service temporarily unavailable. Please try again shortly.");
    }
    return tooMany(Math.ceil(result.resetInMs / 1000), correlationId);
  }
  return null;
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;
  const ip = getClientIp(req);
  const correlationId = getOrGenerateCorrelationId(req);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-correlation-id", correlationId);
  requestHeaders.set("x-request-id", correlationId);

  // 0. CSRF Protection: Validate Origin / Referer on state-mutating methods
  const method = req.method.toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const origin = req.headers.get("origin");
    const referer = req.headers.get("referer");
    const host = req.headers.get("host") || "";

    if (isProductionEnvironment()) {
      if (origin) {
        try {
          const originUrl = new URL(origin);
          const isAllowed =
            originUrl.host === host ||
            originUrl.origin === "http://localhost:3000" ||
            originUrl.origin === "http://127.0.0.1:3000" ||
            originUrl.origin === "http://localhost:8081";
          if (!isAllowed) {
            return withCorrelation(
              NextResponse.json(
                {
                  code: "FORBIDDEN",
                  message: "Cross-origin state mutation rejected.",
                },
                { status: 403 }
              ),
              correlationId
            );
          }
        } catch {
          return withCorrelation(
            NextResponse.json(
              {
                code: "FORBIDDEN",
                message: "Invalid origin header rejected.",
              },
              { status: 403 }
            ),
            correlationId
          );
        }
      } else if (referer) {
        // FIX #7: Fallback to Referer header when Origin header is omitted
        try {
          const refUrl = new URL(referer);
          const isAllowed =
            refUrl.host === host ||
            refUrl.origin === "http://localhost:3000" ||
            refUrl.origin === "http://127.0.0.1:3000" ||
            refUrl.origin === "http://localhost:8081";
          if (!isAllowed) {
            return withCorrelation(
              NextResponse.json(
                {
                  code: "FORBIDDEN",
                  message: "Cross-origin referer rejected.",
                },
                { status: 403 }
              ),
              correlationId
            );
          }
        } catch {
          return withCorrelation(
            NextResponse.json(
              {
                code: "FORBIDDEN",
                message: "Invalid referer header rejected.",
              },
              { status: 403 }
            ),
            correlationId
          );
        }
      }
    }
  }

  // 1. Identity / Auth endpoints — always open to negotiate credentials
  if (pathname.startsWith("/api/auth/") || PUBLIC_API_ROUTES.has(pathname)) {
    return nextWithCorrelation(requestHeaders, correlationId);
  }

  // 2. Extract and verify session token
  const sessionCookie = req.cookies.get("cf_session")?.value?.trim() || "";
  const legacyCookie = req.cookies.get("cf_uid")?.value?.trim() || "";

  // FIX #8: Audit log when legacy cf_uid cookie is used instead of cf_session
  if (!sessionCookie && legacyCookie) {
    console.warn(`[SECURITY DEPRECATION] Legacy cf_uid cookie received from IP ${ip} for path ${pathname}. Migrate to cf_session.`);
  }

  const tokenCandidate = sessionCookie || legacyCookie;

  const sessionPayload = tokenCandidate ? await verifySessionTokenEdge(tokenCandidate) : null;
  const verifiedUserId = sessionPayload?.userId || null;

  // 3. Anonymous login-screen voice assistance
  if (!sessionPayload && PUBLIC_ACCESSIBILITY_POSTS.has(pathname)) {
    const anonKey = buildRateLimitKey("AI_ANON", { ip });
    const limitResult = await checkRateLimitAsync(anonKey, { limit: 12, windowMs: 60 * 1000 });
    const blockedRes = handleRateLimitResult(limitResult, correlationId);
    if (blockedRes) return blockedRes;
    return nextWithCorrelation(requestHeaders, correlationId);
  }

  // 4. Enforce strict session requirement for all other /api/* endpoints
  if (!sessionPayload) {
    return withCorrelation(
      NextResponse.json(
        {
          code: "UNAUTHORIZED",
          message: "Authentication required. A cryptographically signed session token is mandatory.",
        },
        { status: 401 }
      ),
      correlationId
    );
  }

  // 5. Authenticated rate limiting by verified user identity
  if (EMAIL_ROUTES.has(pathname)) {
    const key = buildRateLimitKey("JOB_ALERT", { userId: verifiedUserId, ip });
    const result = await checkRateLimitAsync(key, RATE_LIMIT_POLICIES.JOB_ALERT);
    const blockedRes = handleRateLimitResult(result, correlationId);
    if (blockedRes) return blockedRes;
  } else if (STT_ROUTES.has(pathname)) {
    const key = buildRateLimitKey("STT", { userId: verifiedUserId, ip });
    const result = await checkRateLimitAsync(key, RATE_LIMIT_POLICIES.STT);
    const blockedRes = handleRateLimitResult(result, correlationId);
    if (blockedRes) return blockedRes;
  } else if (TTS_ROUTES.has(pathname)) {
    const key = buildRateLimitKey("TTS", { userId: verifiedUserId, ip });
    const result = await checkRateLimitAsync(key, RATE_LIMIT_POLICIES.TTS);
    const blockedRes = handleRateLimitResult(result, correlationId);
    if (blockedRes) return blockedRes;
  } else if (AI_ROUTES.has(pathname)) {
    const key = buildRateLimitKey("AI_CHAT", { userId: verifiedUserId, ip });
    const result = await checkRateLimitAsync(key, RATE_LIMIT_POLICIES.AI_CHAT);
    const blockedRes = handleRateLimitResult(result, correlationId);
    if (blockedRes) return blockedRes;
  }

  return nextWithCorrelation(requestHeaders, correlationId);
}

export const config = {
  matcher: ["/api/:path*"],
};
