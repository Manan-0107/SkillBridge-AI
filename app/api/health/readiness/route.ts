/**
 * app/api/health/readiness/route.ts
 *
 * Operational Readiness Probe for UBIX.
 * Validates availability of core production dependencies:
 * - Distributed Redis
 * - AI Provider Cascade
 * - Database connectivity state
 *
 * Invariant: Never exposes environment variables, credentials, keys, or internal stack traces.
 */

import { NextResponse } from "next/server";
import { checkRedisHealth } from "@/lib/security/rateLimit";
import { isProductionEnvironment, getEnvironmentName } from "@/lib/security/environment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const isProd = isProductionEnvironment();

  // 1. Check Redis health
  const redisHealth = await checkRedisHealth();

  // 2. Check AI Providers availability (names only, no keys)
  const availableAI: string[] = [];
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_AI_KEY) {
    availableAI.push("gemini");
  }
  if (process.env.GROQ_API_KEY) {
    availableAI.push("groq");
  }
  if (process.env.OPENAI_API_KEY) {
    availableAI.push("openai");
  }
  if (process.env.OPENROUTER_API_KEY) {
    availableAI.push("openrouter");
  }

  // 3. Database readiness check
  const dbConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  const checks = {
    redis: {
      status: redisHealth.status,
      latencyMs: redisHealth.latencyMs,
      errorCategory: redisHealth.errorCategory,
    },
    aiProviders: {
      configured: availableAI.length > 0,
      providers: availableAI,
    },
    database: {
      configured: dbConfigured,
    },
  };

  // In production, redis being healthy and at least one AI provider being available determines readiness
  const isReady = isProd
    ? redisHealth.status === "healthy" && availableAI.length > 0 && dbConfigured
    : true; // Non-prod allows memory fallback and mock AI

  const statusCode = isReady ? 200 : 503;

  return NextResponse.json(
    {
      status: isReady ? "ready" : "not_ready",
      environment: getEnvironmentName(),
      checks,
      timestamp: new Date().toISOString(),
    },
    {
      status: statusCode,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    }
  );
}
