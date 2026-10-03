/**
 * lib/security/rateLimit.ts
 * Production-ready distributed and in-memory sliding-window rate limiter for CareerForge / ubix.
 *
 * Implements:
 * - Distinct policies for: AUTH, AI_CHAT, ASSISTANT, STT, TTS, RESUME_PARSE, RESUME_GENERATION, JOB_SEARCH, JOB_ALERT, PUBLIC_API
 * - Per-IP (anonymous) and per-user (authenticated) composite keys
 * - Distributed Upstash Redis REST integration when environment credentials exist
 * - High-performance in-memory sliding-window fallback with automatic TTL sweeps
 * - Standard RFC rate-limit headers metadata
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

/** Distinct production rate limit policies */
export const RATE_LIMIT_POLICIES = {
  AUTH: { limit: 10, windowMs: 60 * 1000 }, // 10 attempts / min
  OTP: { limit: 5, windowMs: 60 * 1000 }, // 5 OTP dispatches / min
  AI_CHAT: { limit: 25, windowMs: 60 * 1000 }, // 25 queries / min
  ASSISTANT: { limit: 30, windowMs: 60 * 1000 }, // 30 queries / min
  STT: { limit: 15, windowMs: 60 * 1000 }, // 15 audio uploads / min
  TTS: { limit: 25, windowMs: 60 * 1000 }, // 25 audio syntheses / min
  VOICE_WS: { limit: 60, windowMs: 60 * 1000 }, // 60 websocket actions / min
  RESUME_PARSE: { limit: 10, windowMs: 60 * 1000 }, // 10 resume parses / min
  RESUME_ANALYZE: { limit: 10, windowMs: 60 * 1000 }, // 10 analyses / min
  RESUME_GENERATION: { limit: 8, windowMs: 60 * 1000 }, // 8 optimizations / min
  RESUME_SAVE: { limit: 20, windowMs: 60 * 1000 }, // 20 resume saves / min (generous to avoid disrupting edits/autosave)
  JOB_SEARCH: { limit: 30, windowMs: 60 * 1000 }, // 30 job queries / min
  JOB_ALERT: { limit: 5, windowMs: 60 * 1000 }, // 5 email dispatches / min
  PUBLIC_API: { limit: 120, windowMs: 60 * 1000 }, // 120 public requests / min
} as const;

// Backward-compatible presets mapping
export const RATE_LIMIT_PRESETS = {
  ...RATE_LIMIT_POLICIES,
  auth: RATE_LIMIT_POLICIES.AUTH,
  otp: RATE_LIMIT_POLICIES.OTP,
  aiChat: RATE_LIMIT_POLICIES.AI_CHAT,
  audioTranscribe: RATE_LIMIT_POLICIES.STT,
  AUDIO_TRANSCRIBE: RATE_LIMIT_POLICIES.STT,
  audioSynthesize: RATE_LIMIT_POLICIES.TTS,
  AUDIO_SYNTHESIS: RATE_LIMIT_POLICIES.TTS,
  voiceWs: RATE_LIMIT_POLICIES.VOICE_WS,
  resumeAnalyze: RATE_LIMIT_POLICIES.RESUME_ANALYZE,
  resumeUpload: RATE_LIMIT_POLICIES.RESUME_PARSE,
  resumeSave: RATE_LIMIT_POLICIES.RESUME_SAVE,
  jobAlerts: RATE_LIMIT_POLICIES.JOB_ALERT,
  jobsAlert: RATE_LIMIT_POLICIES.JOB_ALERT,
  generalApi: RATE_LIMIT_POLICIES.PUBLIC_API,
};

interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitRecord>();

let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 5 * 60 * 1000;

function cleanupStore() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [key, record] of rateLimitStore.entries()) {
    const valid = record.timestamps.filter((t) => now - t < 10 * 60 * 1000);
    if (valid.length === 0) {
      rateLimitStore.delete(key);
    } else {
      record.timestamps = valid;
    }
  }
}

/**
 * Extracts normalized client IP from request headers.
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
 * Constructs a secure composite rate limit key separating authenticated users from anonymous IPs.
 */
export function buildRateLimitKey(
  category: keyof typeof RATE_LIMIT_POLICIES | string,
  options: { ip?: string; userId?: string | null }
): string {
  if (options.userId && options.userId.trim()) {
    return `${category}:user:${options.userId.trim()}`;
  }
  return `${category}:ip:${options.ip || "127.0.0.1"}`;
}

/**
 * Evaluates rate limit using Upstash Redis REST if configured, otherwise falls back to memory.
 */
export async function checkRateLimitAsync(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (redisUrl && redisToken) {
    try {
      const now = Date.now();
      const pipelineUrl = `${redisUrl}/pipeline`;
      const res = await fetch(pipelineUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${redisToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          ["INCR", key],
          ["PEXPIRE", key, config.windowMs, "NX"],
          ["PTTL", key],
        ]),
        signal: AbortSignal.timeout(2000),
      });

      if (res.ok) {
        const results = await res.json();
        const currentCount = Number(results[0]?.result ?? 1);
        const pttl = Math.max(0, Number(results[2]?.result ?? config.windowMs));

        const isLimited = currentCount > config.limit;
        const remaining = Math.max(0, config.limit - currentCount);

        return {
          isLimited,
          allowed: !isLimited,
          limit: config.limit,
          remaining,
          resetMs: pttl,
          resetInMs: pttl,
        };
      }
    } catch (err) {
      console.warn("[RateLimit] Upstash Redis call failed, using in-memory fallback:", err);
    }
  }

  return checkRateLimit(key, config);
}

/**
 * Synchronous in-memory sliding-window rate limit evaluator.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanupStore();

  const now = Date.now();
  const record = rateLimitStore.get(key) || { timestamps: [] };

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
