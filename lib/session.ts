/**
 * lib/session.ts — the `cf_uid` session cookie, made unforgeable.
 *
 * Audit finding C1: `cf_uid` used to hold a bare, attacker-supplied email and
 * `/api/user` trusted it for identity → trivial account impersonation.
 *
 * Now `cf_uid` is an HMAC-signed token: `<base64url(payload)>.<base64url(sig)>`.
 * It is issued ONLY by `/api/user` PUT, and only after `getAuthenticatedUser()`
 * has verified a real Supabase session. A client cannot mint one without the
 * server's `SESSION_SECRET`, and `verifySessionCookie()` rejects anything that
 * isn't a fresh, correctly-signed token.
 *
 * Node runtime only (route handlers). `middleware.ts` does a coarse presence
 * check; the authoritative signature check happens here in the handlers.
 */

import crypto from "node:crypto";

export const SESSION_COOKIE_NAME = "cf_uid";

const MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_SEC,
};

let warnedMissingSecret = false;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET (>= 16 chars) must be set in production — refusing to sign session cookies with a known value."
    );
  }
  if (!warnedMissingSecret) {
    warnedMissingSecret = true;
    console.warn(
      "[session] SESSION_SECRET is not set — using an INSECURE dev fallback. Set it in .env.local before deploying."
    );
  }
  return "dev-insecure-careerforge-session-secret-change-me";
}

interface SessionPayload {
  /** The verified email this session belongs to. */
  email: string;
  /** Issued-at, ms epoch — used to expire stale tokens. */
  iat: number;
}

const b64url = (buf: Buffer | string) => Buffer.from(buf).toString("base64url");

function hmac(body: string): string {
  return b64url(crypto.createHmac("sha256", secret()).update(body).digest());
}

/** Mint a signed session token for an already-verified email. */
export function signSessionCookie(data: { email: string }): string {
  const payload: SessionPayload = { email: data.email, iat: Date.now() };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${hmac(body)}`;
}

/**
 * Return the session's verified email, or null if the token is missing,
 * malformed, tampered, signed with the wrong key, or older than MAX_AGE.
 */
export function verifySessionCookie(token: string | undefined | null): { email: string } | null {
  if (typeof token !== "string" || !token.includes(".")) return null;

  const dot = token.indexOf(".");
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!body || !sig) return null;

  const expected = hmac(body);
  const got = Buffer.from(sig);
  const want = Buffer.from(expected);
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload || typeof payload.email !== "string" || !payload.email) return null;
    if (typeof payload.iat !== "number" || Date.now() - payload.iat > MAX_AGE_SEC * 1000) return null;
    return { email: payload.email };
  } catch {
    return null;
  }
}
