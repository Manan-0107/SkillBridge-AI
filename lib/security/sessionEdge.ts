/**
 * lib/security/sessionEdge.ts
 * Edge-compatible HMAC-SHA256 session token verification using standard Web Crypto API (crypto.subtle).
 * Zero Node.js runtime dependencies — fully compatible with Next.js Edge Runtime and Middleware.
 */

export interface SessionPayload {
  userId: string;
  email: string;
  name?: string | null;
  role?: string;
  isGuest?: boolean;
  createdAt: number;
  expiresAt: number;
}

function base64UrlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4 ? "=".repeat(4 - (base64.length % 4)) : "";
  const binary = atob(base64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function verifySessionTokenEdge(
  token: string,
  secret?: string
): Promise<SessionPayload | null> {
  if (!token || typeof token !== "string") return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [serialized, signature] = parts;
  if (!serialized || !signature) return null;

  let hmacSecret = secret || process.env.SESSION_SECRET;
  if (!hmacSecret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "FATAL SECURITY ERROR: SESSION_SECRET must be explicitly configured in production. Silent fallback is prohibited."
      );
    }
    hmacSecret = "careerforge-dev-only-hmac-salt-strictly-not-for-production-min-32-chars";
  } else if (process.env.NODE_ENV === "production" && hmacSecret.length < 32) {
    throw new Error(
      "FATAL SECURITY ERROR: Production SESSION_SECRET must be at least 32 characters long."
    );
  }

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(hmacSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signatureBytes = base64UrlToUint8Array(signature);
    const dataBytes = encoder.encode(serialized);

    const isValid = await crypto.subtle.verify("HMAC", key, signatureBytes as any, dataBytes);
    if (!isValid) return null;

    const payloadJson = new TextDecoder().decode(base64UrlToUint8Array(serialized));
    const payload: SessionPayload = JSON.parse(payloadJson);

    if (!payload.userId || !payload.expiresAt || Date.now() > payload.expiresAt) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
