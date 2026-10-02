/**
 * lib/security/wsSecurity.ts
 *
 * WebSocket & Voice Streaming Security Module:
 * - Strict origin validation allowlist (blocks CSWSH - Cross-Site WebSocket Hijacking)
 * - Session token extraction and cryptographic HMAC verification
 * - Connection quota and rate limit definitions
 */

import { verifySessionToken, SessionPayload } from "./session.ts";

export const ALLOWED_WS_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8081,https://ubix.example.com")
    .split(",")
    .map((o) => o.trim().toLowerCase())
    .filter(Boolean)
);

export function isOriginAllowed(origin?: string | null): boolean {
  if (!origin || typeof origin !== "string") return false;
  try {
    const originUrl = new URL(origin);
    const normalized = `${originUrl.protocol}//${originUrl.host}`.toLowerCase();
    return ALLOWED_WS_ORIGINS.has(normalized);
  } catch {
    return false;
  }
}

export { verifySessionToken };
export type { SessionPayload };
