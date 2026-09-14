/**
 * Edge middleware — the single authentication gate + cost guard for `/api/*`.
 *
 * Root cause it fixes (audit finding C3): CareerForge had no middleware and no
 * per-route auth, so every API route ran for every anonymous caller — including
 * the ones that spend money on third-party AI/STT/TTS/email keys, and
 * `/api/resume/save` which trusted a `userId` from the request body (IDOR).
 *
 * Policy:
 *   1. `/api/user/**` — the identity subsystem itself (session check, sign-in,
 *      sign-out, anon profile fallback). Always open.
 *   2. `/api/assistant/chat` — reachable from the signed-out login screen, where
 *      blind users ask the voice assistant for help signing in. Open, but hard
 *      per-IP rate-limited.
 *   3. Everything else under `/api/*` requires the `cf_uid` session cookie →
 *      401 otherwise. (There are currently no genuinely-public GET routes; every
 *      other endpoint is consumed only by authenticated feature views. Add one
 *      to `PUBLIC_GET` if that changes.)
 *   4. The expensive routes are additionally token-bucketed per session (or per
 *      IP when anonymous): AI routes and the email dispatcher.
 *
 * The `cf_uid` cookie is only a *presence* check here. Making it unforgeable
 * (HMAC-sign it in /api/user, verify here) is audit finding C1 — still required,
 * tracked separately.
 */

import { NextRequest, NextResponse } from "next/server";
import { takeToken, type RateLimitRule } from "@/lib/rateLimit";

/** Genuinely public GET endpoints (no secrets, no per-user data). None today. */
const PUBLIC_GET = new Set<string>([]);

/** Open without a session, but strictly per-IP rate-limited (login-screen voice help). */
const PUBLIC_POST = new Set<string>(["/api/assistant/chat"]);

/** AI / inference routes — throttled to stop quota burn. */
const AI_ROUTES = new Set<string>([
  "/api/chat",
  "/api/assistant/chat",
  "/api/resume/analyze",
  "/api/resume/optimize",
  "/api/speech/transcribe",
  "/api/speech/synthesize",
  "/api/speech/detect-language",
  "/api/audio/transcribe",
  "/api/audio/synthesize",
]);

/** Email dispatch — the biggest abuse magnet, throttled hardest. */
const EMAIL_ROUTES = new Set<string>(["/api/jobs/alert"]);

const AI_RULE: RateLimitRule = { capacity: 12, refillPerSec: 0.2 }; // ~1 / 5s sustained, burst 12
const AI_ANON_RULE: RateLimitRule = { capacity: 5, refillPerSec: 0.1 }; // ~1 / 10s, burst 5
const EMAIL_RULE: RateLimitRule = { capacity: 3, refillPerSec: 1 / 30 }; // ~1 / 30s, burst 3

function clientIp(req: NextRequest): string {
  return (
    req.ip ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function tooMany(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    { error: "Rate limit exceeded. Please slow down and try again shortly." },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
  );
}

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  const method = req.method.toUpperCase();

  // 1. Identity subsystem — always open.
  if (pathname === "/api/user" || pathname.startsWith("/api/user/")) {
    return NextResponse.next();
  }

  // 2. Genuinely public GETs.
  if ((method === "GET" || method === "HEAD") && PUBLIC_GET.has(pathname)) {
    return NextResponse.next();
  }

  const session = req.cookies.get("cf_uid")?.value?.trim() || "";

  // 3. Anonymous access to the login-screen voice helper — per-IP throttle only.
  if (!session && PUBLIC_POST.has(pathname)) {
    const gate = takeToken(`ai-anon:${clientIp(req)}`, AI_ANON_RULE);
    return gate.ok ? NextResponse.next() : tooMany(gate.retryAfterSec);
  }

  // 4. Everything else requires a session.
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // 5. Authenticated — throttle the expensive routes per session.
  if (EMAIL_ROUTES.has(pathname)) {
    const gate = takeToken(`email:${session}`, EMAIL_RULE);
    if (!gate.ok) return tooMany(gate.retryAfterSec);
  } else if (AI_ROUTES.has(pathname)) {
    const gate = takeToken(`ai:${session}`, AI_RULE);
    if (!gate.ok) return tooMany(gate.retryAfterSec);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
