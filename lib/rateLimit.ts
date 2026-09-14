/**
 * Token-bucket rate limiter.
 *
 * ponytail: in-memory Map, per-instance. Correct for a single Node/Edge
 * instance; if CareerForge is ever run multi-instance, swap `buckets` for a
 * shared store (Upstash Redis `@upstash/ratelimit`, Vercel KV, …). The public
 * API here stays the same.
 */

interface Bucket {
  /** Fractional tokens available right now. */
  tokens: number;
  /** Date.now() of the last refill. */
  updated: number;
}

export interface RateLimitRule {
  /** Max burst — the bucket size. */
  capacity: number;
  /** Sustained rate, tokens added per second. */
  refillPerSec: number;
}

const buckets = new Map<string, Bucket>();

/** Drop buckets that have sat full (i.e. unused) for a while, so the Map can't grow without bound. */
const MAX_BUCKETS = 10_000;
const STALE_MS = 10 * 60 * 1000;

function sweep(now: number) {
  for (const [key, b] of buckets) {
    if (now - b.updated > STALE_MS) buckets.delete(key);
  }
}

/**
 * Consume one token for `key`. Returns:
 *   { ok: true }                         — allowed
 *   { ok: false, retryAfterSec: number } — limited; hint for a `Retry-After` header
 */
export function takeToken(
  key: string,
  rule: RateLimitRule
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();

  if (buckets.size > MAX_BUCKETS) sweep(now);

  const b = buckets.get(key) ?? { tokens: rule.capacity, updated: now };
  const refill = ((now - b.updated) / 1000) * rule.refillPerSec;
  b.tokens = Math.min(rule.capacity, b.tokens + refill);
  b.updated = now;

  if (b.tokens < 1) {
    buckets.set(key, b);
    const retryAfterSec = Math.ceil((1 - b.tokens) / rule.refillPerSec);
    return { ok: false, retryAfterSec: Math.max(1, retryAfterSec) };
  }

  b.tokens -= 1;
  buckets.set(key, b);
  return { ok: true };
}

/** Test-only: wipe all buckets. */
export function __resetRateLimiter() {
  buckets.clear();
}
