/**
 * lib/security/session.ts
 * Cryptographically Secure Session Management for CareerForge.
 *
 * Implements:
 * - Cryptographic HMAC-SHA256 session token generation and verification
 * - Tamper-proof cookie signing for cf_session / cf_uid
 * - Isolated server-generated guest identities (no shared accounts)
 * - Expiration and replay attack protection
 */

import crypto from "crypto";

export interface SessionPayload {
  userId: string;
  email: string;
  name?: string | null;
  role?: string;
  isGuest?: boolean;
  createdAt: number;
  expiresAt: number;
}

const SESSION_COOKIE_NAME = "cf_session";
const LEGACY_COOKIE_NAME = "cf_uid";

// Default 30-day session lifetime (guests: 7 days)
const DEFAULT_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const GUEST_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "FATAL SECURITY ERROR: SESSION_SECRET must be explicitly configured in production. Silent fallback is prohibited."
      );
    }
    // Explicit development-only salt (never used when NODE_ENV === 'production')
    return "careerforge-dev-only-hmac-salt-strictly-not-for-production-min-32-chars";
  }
  if (process.env.NODE_ENV === "production" && secret.length < 32) {
    throw new Error(
      "FATAL SECURITY ERROR: Production SESSION_SECRET must be at least 32 characters long."
    );
  }
  return secret;
}

/**
 * Creates an HMAC-SHA256 signed session token.
 * Format: base64url(payloadJson).base64url(hmacSignature)
 */
export function createSignedSessionToken(
  params: Omit<SessionPayload, "createdAt" | "expiresAt"> & { ttlMs?: number }
): string {
  const now = Date.now();
  const ttl = params.ttlMs ?? (params.isGuest ? GUEST_SESSION_TTL_MS : DEFAULT_SESSION_TTL_MS);

  const payload: SessionPayload = {
    userId: params.userId,
    email: params.email.toLowerCase().trim(),
    name: params.name ?? null,
    role: params.role,
    isGuest: Boolean(params.isGuest),
    createdAt: now,
    expiresAt: now + ttl,
  };

  const serialized = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const secret = getSessionSecret();
  const signature = crypto.createHmac("sha256", secret).update(serialized).digest("base64url");

  return `${serialized}.${signature}`;
}

/**
 * Verifies an HMAC-SHA256 signed session token.
 * Returns null if token is malformed, signature is invalid, or session is expired.
 */
export function verifySessionToken(token: string): SessionPayload | null {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [serialized, signature] = parts;
  if (!serialized || !signature) return null;

  const secret = getSessionSecret();
  const expectedSignature = crypto.createHmac("sha256", secret).update(serialized).digest("base64url");

  // Constant-time comparison to prevent timing attacks
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const raw = Buffer.from(serialized, "base64url").toString("utf-8");
    const payload = JSON.parse(raw) as SessionPayload;

    if (!payload.userId || !payload.email || typeof payload.expiresAt !== "number") {
      return null;
    }

    if (Date.now() > payload.expiresAt) {
      // Expired session
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Generates an isolated guest identity.
 * NEVER shares one real user identity (e.g. Alex Rivera) between unrelated users.
 */
export function generateIsolatedGuestIdentity(): {
  userId: string;
  email: string;
  name: string;
} {
  const uniqueId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return {
    userId: `guest_${uniqueId}`,
    email: `guest_${uniqueId}@guest.careerforge.internal`,
    name: `Guest Explorer (${uniqueId.slice(0, 4).toUpperCase()})`,
  };
}

export const SESSION_CONFIG = {
  cookieName: SESSION_COOKIE_NAME,
  legacyCookieName: LEGACY_COOKIE_NAME,
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
};
