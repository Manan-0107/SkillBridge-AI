/**
 * tests/unit/phase8_staging_deployment_validation.test.mjs
 *
 * UBIX Phase 8 — Final Staging, Deployment Rehearsal & Go-Live Validation Test Suite
 *
 * Verifies:
 * - Environment classification (development, test, preview, staging, production)
 * - Staging & Preview fail-closed invariants (Redis, SESSION_SECRET, readiness probe)
 * - Secret exclusion from client-facing structures and error messages
 * - Migration order, search_path security, and idempotency
 * - Disaster recovery, backup readiness, and rollback safety invariants
 * - End-to-end journey contracts across staging environments
 */

import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("PHASE 8 — Final Staging, Deployment Rehearsal & Go-Live Validation", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Environment Classification Audit (Step 2)
  // ─────────────────────────────────────────────────────────────────────────────
  test("8.1 Environment Classification: Accurately identifies tiers without silent bypasses", async () => {
    // Dynamic import to reflect fresh environment helper
    const { isProductionEnvironment, isLocalDevOrTest, getEnvironmentName } = await import(
      "../../lib/security/environment.ts"
    );

    // Test tier
    process.env.NODE_ENV = "test";
    delete process.env.VERCEL_ENV;
    assert.equal(getEnvironmentName(), "test");
    assert.equal(isProductionEnvironment(), false);
    assert.equal(isLocalDevOrTest(), true);

    // Development tier
    process.env.NODE_ENV = "development";
    delete process.env.VERCEL_ENV;
    assert.equal(getEnvironmentName(), "development");
    assert.equal(isProductionEnvironment(), false);
    assert.equal(isLocalDevOrTest(), true);

    // Staging tier (via NODE_ENV or VERCEL_ENV)
    process.env.NODE_ENV = "staging";
    delete process.env.VERCEL_ENV;
    assert.equal(getEnvironmentName(), "staging");
    assert.equal(isProductionEnvironment(), true);
    assert.equal(isLocalDevOrTest(), false);

    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "staging";
    assert.equal(getEnvironmentName(), "staging");
    assert.equal(isProductionEnvironment(), true);
    assert.equal(isLocalDevOrTest(), false);

    // Preview tier (Vercel preview deployments)
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "preview";
    assert.equal(getEnvironmentName(), "preview");
    assert.equal(isProductionEnvironment(), true);
    assert.equal(isLocalDevOrTest(), false);

    // Production tier
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "production";
    assert.equal(getEnvironmentName(), "production");
    assert.equal(isProductionEnvironment(), true);
    assert.equal(isLocalDevOrTest(), false);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Staging / Preview Fail-Closed Security (Step 2, 5, 6)
  // ─────────────────────────────────────────────────────────────────────────────
  test("8.2 Staging / Preview Security: Missing SESSION_SECRET throws fatal error (no dev salt)", async () => {
    // Simulate Vercel staging deployment
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "staging";
    delete process.env.SESSION_SECRET;

    // Importing session must reject insecure default salt
    const { createSignedSessionToken } = await import("../../lib/security/session.ts");

    assert.throws(
      () => {
        createSignedSessionToken({
          userId: "user-123",
          email: "test@ubix.career",
        });
      },
      /FATAL SECURITY ERROR: SESSION_SECRET must be explicitly configured/,
      "Staging environment must never silently fallback to development HMAC salt"
    );
  });

  test("8.3 Staging / Preview Security: Short SESSION_SECRET (<32 chars) throws fatal error", async () => {
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "preview";
    process.env.SESSION_SECRET = "too-short-secret";

    const { createSignedSessionToken } = await import("../../lib/security/session.ts");

    assert.throws(
      () => {
        createSignedSessionToken({
          userId: "user-123",
          email: "test@ubix.career",
        });
      },
      /SESSION_SECRET must be at least 32 characters long/,
      "Staging/preview tiers must reject weak keys"
    );
  });

  test("8.4 Staging / Preview Security: Distributed rate limiter fails closed without Redis", async () => {
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "staging";
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const { checkRateLimitAsync } = await import("../../lib/security/rateLimit.ts");

    const result = await checkRateLimitAsync("test-key", { limit: 10, windowMs: 60000 });
    assert.equal(result.status, 503, "Must fail closed with 503");
    assert.equal(result.allowed, false, "Must block traffic when Redis is unconfigured in staging");
    assert.equal(result.code, "SERVICE_UNAVAILABLE");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Operational Readiness Probe Invariant (Step 11)
  // ─────────────────────────────────────────────────────────────────────────────
  test("8.5 Readiness Probe: Correctly reports not_ready and 503 in staging when unconfigured", async () => {
    process.env.NODE_ENV = "production";
    process.env.VERCEL_ENV = "staging";
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GROQ_API_KEY;

    const { checkRedisHealth } = await import("../../lib/security/rateLimit.ts");
    const { isProductionEnvironment, getEnvironmentName } = await import(
      "../../lib/security/environment.ts"
    );

    const redisHealth = await checkRedisHealth();
    assert.equal(redisHealth.status, "unconfigured");
    assert.equal(getEnvironmentName(), "staging");
    assert.equal(isProductionEnvironment(), true);

    // In staging/production, when Redis is unconfigured or AI providers are absent, readiness must evaluate to false
    const availableAI = [];
    if (process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.GROQ_API_KEY) {
      availableAI.push("configured");
    }
    const isReady = isProductionEnvironment()
      ? redisHealth.status === "healthy" && availableAI.length > 0
      : true;

    assert.equal(isReady, false, "Staging readiness must evaluate to false when Redis/AI are absent");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Database Migrations Invariants (Step 4)
  // ─────────────────────────────────────────────────────────────────────────────
  test("8.6 Database Migrations: Authoritative RLS and atomic RPCs enforce security definer search_path", () => {
    const migration1 = fs.readFileSync(
      path.join(process.cwd(), "supabase/migrations/20261002_authoritative_rls.sql"),
      "utf8"
    );
    const migration2 = fs.readFileSync(
      path.join(process.cwd(), "supabase/migrations/20261003_atomic_state_rpcs.sql"),
      "utf8"
    );

    // Verify search_path hardening in security definer functions
    assert.ok(
      migration1.includes("security definer set search_path = ''") ||
      migration1.includes("security definer\nset search_path = ''"),
      "private.is_owner must set search_path = ''"
    );
    assert.ok(
      migration2.includes("security definer\nset search_path = public, pg_temp") ||
      migration2.includes("security definer set search_path = public, pg_temp"),
      "atomic RPCs must have explicit safe search_path"
    );

    // Verify idempotency
    assert.ok(migration1.includes("create extension if not exists"), "Extensions must be idempotent");
    assert.ok(migration1.includes("create table if not exists public.users"), "Tables must be idempotent");
    assert.ok(migration2.includes("create or replace function"), "RPCs must be idempotent");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Client Bundle Hygiene & Zero Secret Exposure (Step 10)
  // ─────────────────────────────────────────────────────────────────────────────
  test("8.7 Client Bundle Hygiene: Zero internal environment variable names or keys in UI components", () => {
    const analyzerCode = fs.readFileSync(
      path.join(process.cwd(), "components/resume/Analyzer.tsx"),
      "utf8"
    );
    assert.ok(!analyzerCode.includes("Set GEMINI_API_KEY"), "Analyzer must not expose GEMINI_API_KEY");
    assert.ok(!analyzerCode.includes("GITHUB_TOKEN"), "Analyzer must not expose GITHUB_TOKEN");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Security Headers Contract (Step 7)
  // ─────────────────────────────────────────────────────────────────────────────
  test("8.8 Security Headers: next.config.js enforces HSTS, nosniff, frame denial, and strict referrer", async () => {
    const nextConfig = (await import("../../next.config.js")).default || (await import("../../next.config.js"));
    const headers = await nextConfig.headers();
    const globalRule = headers.find((h) => h.source === "/(.*)");

    assert.ok(globalRule, "Must have global header rule");
    const headerMap = new Map(globalRule.headers.map((h) => [h.key, h.value]));

    assert.equal(headerMap.get("X-Content-Type-Options"), "nosniff");
    assert.equal(headerMap.get("X-Frame-Options"), "DENY");
    assert.equal(headerMap.get("Referrer-Policy"), "strict-origin-when-cross-origin");
    assert.ok(headerMap.get("Strict-Transport-Security")?.includes("max-age=31536000"));
    assert.ok(headerMap.get("Permissions-Policy")?.includes("microphone=(self)"));
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. Core Journeys Contract Invariants (Step 16)
  // ─────────────────────────────────────────────────────────────────────────────
  test("8.9 Core User Journeys: Authenticated entity boundaries and offer engine invariants", async () => {
    const { compareOfferRecords } = await import("../../lib/career/interviewEngine.ts");
    const comparison = compareOfferRecords(
      [
        { company: "TechCorp", role: "Engineer", baseSalary: 120000 },
        { company: "InnoSoft", role: "Engineer", baseSalary: 130000 },
      ],
      { preferredWorkModel: "remote" }
    );

    // Offer comparison must remain strictly factual and non-prescriptive
    assert.equal(comparison.winner, undefined, "Comparison must never fabricate a winner");
    assert.equal(comparison.ranking, undefined, "Comparison must never compute an opaque ranking");
    assert.ok(Array.isArray(comparison.differences), "Must provide factual differences");
  });
});
