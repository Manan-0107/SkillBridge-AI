/**
 * lib/security/rateLimit.ts
 * Production-ready in-memory sliding-window rate limiter for CareerForge.
 *
 * Implements:
 * - Per-IP and per-user limits
 * - Endpoint-specific limits (AI, audio transcription, synthesis, job alerts, auth)
 * - Automatic window cleanup to prevent memory exhaustion
 * - Headers standard: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
 */

export interface RequestWithHeaders {
  headers: {
    get(name: string): string | null;
  };
}

export interface RateLimitConfig {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  isLimited: boolean;
  allowed: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
  resetInMs: number;
}

// Default presets by category
export const RATE_LIMIT_PRESETS = {
  auth: { limit: 10, windowMs: 60 * 1000 }, // 10 attempts per minute
  aiChat: { limit: 30, windowMs: 60 * 1000 }, // 30 queries per minute
  audioTranscribe: { limit: 15, windowMs: 60 * 1000 }, // 15 audio uploads per minute
  AUDIO_TRANSCRIBE: { limit: 15, windowMs: 60 * 1000 },
  audioSynthesize: { limit: 25, windowMs: 60 * 1000 }, // 25 TTS requests per minute
  AUDIO_SYNTHESIS: { limit: 25, windowMs: 60 * 1000 },
  resumeAnalyze: { limit: 12, windowMs: 60 * 1000 }, // 12 resume analyses per minute
  resumeUpload: { limit: 10, windowMs: 60 * 1000 }, // 10 resume file uploads per minute
  jobAlerts: { limit: 5, windowMs: 60 * 1000 }, // 5 alerts per minute
  generalApi: { limit: 120, windowMs: 60 * 1000 }, // 120 requests per minute
};

interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Cleanup old entries every 5 minutes to prevent memory leak
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 5 * 60 * 1000;

function cleanupStore() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [key, record] of rateLimitStore.entries()) {
    // Keep entries that have timestamps in the last 10 minutes
    const valid = record.timestamps.filter((t) => now - t < 10 * 60 * 1000);
    if (valid.length === 0) {
      rateLimitStore.delete(key);
    } else {
      record.timestamps = valid;
    }
  }
}

/**
 * Extracts a normalized client IP from request headers.
 */
export function getClientIp(req: RequestWithHeaders): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

/**
 * Evaluates rate limit for a given key (user ID, IP, or combination).
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanupStore();

  const now = Date.now();
  const record = rateLimitStore.get(key) || { timestamps: [] };

  // Remove timestamps outside the sliding window
  const windowStart = now - config.windowMs;
  record.timestamps = record.timestamps.filter((t) => t > windowStart);

  if (record.timestamps.length >= config.limit) {
    const earliestInWindow = record.timestamps[0] || now;
    const resetMs = Math.max(0, earliestInWindow + config.windowMs - now);
    rateLimitStore.set(key, record);

    return {
      isLimited: true,
      allowed: false,
      limit: config.limit,
      remaining: 0,
      resetMs,
      resetInMs: resetMs,
    };
  }

  // Record this request
  record.timestamps.push(now);
  rateLimitStore.set(key, record);

  const remaining = Math.max(0, config.limit - record.timestamps.length);
  const resetMs = config.windowMs;

  return {
    isLimited: false,
    allowed: true,
    limit: config.limit,
    remaining,
    resetMs,
    resetInMs: resetMs,
  };
}
