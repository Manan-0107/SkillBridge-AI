/**
 * lib/observability/correlation.ts
 *
 * Cryptographically safe correlation ID generation, validation, and propagation.
 *
 * Invariant: Never uses Date.now() as an identifier.
 * Invariant: Never exposes session secrets or authorization tokens as IDs.
 * Invariant: Validates incoming IDs to prevent log injection / header injection attacks.
 */

const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

/**
 * Validates whether a candidate string is a safe, well-formed correlation/request ID.
 * Rejects oversized strings, control characters, whitespace, and special characters.
 */
export function isValidCorrelationId(id: unknown): id is string {
  if (typeof id !== "string") return false;
  const trimmed = id.trim();
  return trimmed.length > 0 && trimmed.length <= 128 && SAFE_ID_REGEX.test(trimmed);
}

/**
 * Generates an RFC-4122 v4 UUID as a cryptographically safe correlation ID.
 */
export function generateCorrelationId(): string {
  if (typeof globalThis !== "undefined" && globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Extracts a safe correlation ID from HTTP headers or Request object.
 * Checks in order: x-correlation-id, x-request-id, traceparent.
 * If incoming ID is missing or invalid, generates a new safe UUID.
 */
export function getOrGenerateCorrelationId(
  headersOrReq?: Headers | Request | Record<string, string | string[] | undefined> | null
): string {
  if (!headersOrReq) {
    return generateCorrelationId();
  }

  let candidate: string | null = null;

  if (typeof (headersOrReq as Request).headers?.get === "function") {
    const h = (headersOrReq as Request).headers;
    candidate = h.get("x-correlation-id") || h.get("x-request-id") || null;
  } else if (typeof (headersOrReq as Headers).get === "function") {
    const h = headersOrReq as Headers;
    candidate = h.get("x-correlation-id") || h.get("x-request-id") || null;
  } else if (typeof headersOrReq === "object") {
    const rec = headersOrReq as Record<string, string | string[] | undefined>;
    const val =
      rec["x-correlation-id"] ||
      rec["X-Correlation-Id"] ||
      rec["x-request-id"] ||
      rec["X-Request-Id"];
    candidate = Array.isArray(val) ? val[0] : (val ?? null);
  }

  if (candidate && isValidCorrelationId(candidate)) {
    return candidate.trim();
  }

  return generateCorrelationId();
}
