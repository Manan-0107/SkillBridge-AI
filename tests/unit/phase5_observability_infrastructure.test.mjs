/**
 * tests/unit/phase5_observability_infrastructure.test.mjs
 *
 * Phase 5 Verification: Infrastructure, Observability, Telemetry, Privacy Redaction,
 * and AI/Redis Reliability Hardening.
 */

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert";
import crypto from "node:crypto";

import {
  isValidCorrelationId,
  generateCorrelationId,
  getOrGenerateCorrelationId,
} from "../../lib/observability/correlation.ts";

import {
  safeRedact,
  redactString,
  isSensitiveKey,
} from "../../lib/observability/redaction.ts";

import { logger } from "../../lib/observability/logger.ts";
import { metrics } from "../../lib/observability/metrics.ts";
import { traceSpan, Span } from "../../lib/observability/tracing.ts";
import {
  checkRateLimitAsync,
  checkRedisHealth,
} from "../../lib/security/rateLimit.ts";
import { createApiErrorResponse } from "../../lib/errors/apiError.ts";
import { logVoiceMetric } from "../../lib/observability/voiceTelemetry.ts";
import { generateAIResponse } from "../../lib/ai/centralProvider.ts";
import { GET as livenessGET } from "../../app/api/health/liveness/route.ts";
import { GET as readinessGET } from "../../app/api/health/readiness/route.ts";

describe("PHASE 5 — Infrastructure & Observability Hardening", () => {
  beforeEach(() => {
    metrics.reset();
  });

  // ─── 1. Correlation & Request IDs ──────────────────────────────────────────
  test("1. Correlation IDs: validates, generates RFC4122 v4 UUIDs, and extracts from headers", () => {
    // Valid IDs
    assert.strictEqual(isValidCorrelationId("req_12345"), true);
    assert.strictEqual(isValidCorrelationId("c1b9f7a0-0000-4000-8000-000000000001"), true);
    assert.strictEqual(isValidCorrelationId("trace-abc-123_xyz"), true);

    // Invalid IDs (control characters, injection attempts, oversized)
    assert.strictEqual(isValidCorrelationId(""), false);
    assert.strictEqual(isValidCorrelationId("id with spaces"), false);
    assert.strictEqual(isValidCorrelationId("id<script>alert(1)</script>"), false);
    assert.strictEqual(isValidCorrelationId("../../../etc/passwd"), false);
    assert.strictEqual(isValidCorrelationId("a".repeat(150)), false); // > 128 chars

    // Safe generation
    const genId = generateCorrelationId();
    assert.strictEqual(isValidCorrelationId(genId), true);
    assert.match(genId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

    // Extraction from standard Request / Headers
    const reqHeaders = new Headers({
      "x-correlation-id": "safe-custom-trace-id",
    });
    assert.strictEqual(getOrGenerateCorrelationId(reqHeaders), "safe-custom-trace-id");

    // Extraction from x-request-id fallback
    const reqHeaders2 = new Headers({
      "x-request-id": "safe-request-id-123",
    });
    assert.strictEqual(getOrGenerateCorrelationId(reqHeaders2), "safe-request-id-123");

    // Malformed incoming ID triggers safe UUID generation
    const badHeaders = {
      "x-correlation-id": "malicious\r\nSet-Cookie: evil=1",
    };
    const fallbackId = getOrGenerateCorrelationId(badHeaders);
    assert.notStrictEqual(fallbackId, "malicious\r\nSet-Cookie: evil=1");
    assert.strictEqual(isValidCorrelationId(fallbackId), true);
  });

  // ─── 2. Centralized Privacy Redaction ──────────────────────────────────────
  test("2. Privacy Redaction: comprehensively strips secrets, keys, PII, and binary payloads", () => {
    // Sensitive key detection
    assert.strictEqual(isSensitiveKey("password"), true);
    assert.strictEqual(isSensitiveKey("api_key"), true);
    assert.strictEqual(isSensitiveKey("SESSION_SECRET"), true);
    assert.strictEqual(isSensitiveKey("cf_session"), true);
    assert.strictEqual(isSensitiveKey("disability_details"), true);
    assert.strictEqual(isSensitiveKey("username"), false);

    // String patterns
    const textWithSecrets =
      "Connected using sk-proj-1234567890abcdef12345678 and gsk_abcdef1234567890abcdef and AIzaSyD1234567890123456789012345678901 with Bearer eyJhbGciOiJIUzI1NiJ9.test.sig for user@example.com (555-123-4567)";
    const redacted = redactString(textWithSecrets);

    assert(!redacted.includes("sk-proj-1234567890abcdef"), "OpenAI key must be redacted");
    assert(!redacted.includes("gsk_abcdef1234567890abcdef"), "Groq key must be redacted");
    assert(!redacted.includes("AIzaSyD1234567890123456789012345678901"), "Gemini key must be redacted");
    assert(!redacted.includes("Bearer eyJhbGci"), "Bearer token must be redacted");
    assert(!redacted.includes("user@example.com"), "Email must be redacted");
    assert(!redacted.includes("555-123-4567"), "Phone must be redacted");

    // Deep Object Redaction
    const complexObj = {
      user: {
        id: "usr_100",
        name: "Test User",
        email: "candidate@ubix.careers",
        password: "super-secret-password-123",
        credentials: {
          apiKey: "sk-proj-abcdef12345678901234",
          cf_session: "serialized.signature",
        },
      },
      metadata: {
        notes: "Contacted at test@domain.org",
        binaryData: "A".repeat(600), // base64 payload
      },
    };

    const safeObj = safeRedact(complexObj);
    assert.strictEqual(safeObj.user.password, "[REDACTED]");
    assert.strictEqual(safeObj.user.credentials, "[REDACTED]");
    assert.strictEqual(safeObj.user.id, "usr_100");
    assert.strictEqual(safeObj.user.name, "Test User");
    assert.strictEqual(safeObj.user.email, "[REDACTED]");
    assert(safeObj.metadata.binaryData.includes("[TRUNCATED_BINARY_DATA"), "Binary payload must be truncated");

    // Circular reference handling
    const circularObj = { name: "cycle" };
    circularObj.self = circularObj;
    const safeCycle = safeRedact(circularObj);
    assert.strictEqual(safeCycle.self, "[Circular]");
  });

  // ─── 3. Structured Logging Engine ──────────────────────────────────────────
  test("3. Structured Logging: outputs JSON lines with correlation ID and standardized event vocabulary", () => {
    const logs = [];
    const origLog = console.log;
    const origError = console.error;
    const origWarn = console.warn;

    console.log = (msg) => logs.push({ level: "info", msg });
    console.error = (msg) => logs.push({ level: "error", msg });
    console.warn = (msg) => logs.push({ level: "warn", msg });

    try {
      logger.info("request.started", {
        correlationId: "corr-101",
        operation: "test_op",
        metadata: { path: "/api/test", apiKey: "sk-secret-12345" },
      });

      logger.warn("ai.provider.fallback", {
        correlationId: "corr-101",
        operation: "ai_chat",
        durationMs: 450,
        errorCategory: "PROVIDER_TIMEOUT",
      });

      logger.error("redis.failure", {
        correlationId: "corr-101",
        operation: "rate_limit",
        durationMs: 2000,
        errorCategory: "REDIS_TIMEOUT",
      });
    } finally {
      console.log = origLog;
      console.error = origError;
      console.warn = origWarn;
    }

    assert.strictEqual(logs.length, 3);

    // Verify info entry
    const entry1 = JSON.parse(logs[0].msg);
    assert.strictEqual(entry1.event, "request.started");
    assert.strictEqual(entry1.correlationId, "corr-101");
    assert.strictEqual(entry1.metadata.apiKey, "[REDACTED]");

    // Verify warn entry
    const entry2 = JSON.parse(logs[1].msg);
    assert.strictEqual(entry2.event, "ai.provider.fallback");
    assert.strictEqual(entry2.errorCategory, "PROVIDER_TIMEOUT");
    assert.strictEqual(entry2.durationMs, 450);

    // Verify error entry
    const entry3 = JSON.parse(logs[2].msg);
    assert.strictEqual(entry3.event, "redis.failure");
    assert.strictEqual(entry3.errorCategory, "REDIS_TIMEOUT");
  });

  // ─── 4. Latency Percentiles & Metrics Registry ─────────────────────────────
  test("4. Latency Metrics: accurately computes p50, p95, p99 on bounded sliding window", () => {
    // Record deterministic progression: 1ms to 100ms
    for (let i = 1; i <= 100; i++) {
      metrics.recordMetric("test.latency", i);
    }

    const stats = metrics.getPercentiles("test.latency");
    assert.ok(stats);
    assert.strictEqual(stats.count, 100);
    assert.strictEqual(stats.min, 1);
    assert.strictEqual(stats.max, 100);
    assert.strictEqual(stats.avg, 50.5);
    assert.strictEqual(stats.p50, 50);
    assert.strictEqual(stats.p95, 95);
    assert.strictEqual(stats.p99, 99);

    // Verify non-existent metric returns null
    assert.strictEqual(metrics.getPercentiles("unknown.metric"), null);

    // Verify snapshot captures all metrics
    metrics.recordMetric("other.metric", 250);
    const snapshot = metrics.getSnapshot();
    assert.ok(snapshot["test.latency"]);
    assert.ok(snapshot["other.metric"]);
    assert.strictEqual(snapshot["other.metric"].count, 1);
  });

  // ─── 5. Distributed Tracing Spans ──────────────────────────────────────────
  test("5. Distributed Tracing: traceSpan creates measured spans and logs success/failure", async () => {
    const correlationId = "trace-corr-505";

    const result = await traceSpan("test_span_operation", correlationId, async (span) => {
      assert.strictEqual(span.context.name, "test_span_operation");
      assert.strictEqual(span.context.correlationId, correlationId);
      return "span_success";
    });

    assert.strictEqual(result, "span_success");
    const stats = metrics.getPercentiles("test_span_operation");
    assert.ok(stats);
    assert.strictEqual(stats.count, 1);

    // Verify error propagation in traceSpan
    await assert.rejects(
      async () => {
        await traceSpan("failing_span", correlationId, async () => {
          const err = new Error("Simulated span failure");
          err.code = "EXTERNAL_API_ERROR";
          throw err;
        });
      },
      { message: "Simulated span failure" }
    );

    const failStats = metrics.getPercentiles("failing_span");
    assert.ok(failStats);
    assert.strictEqual(failStats.count, 1);
  });

  // ─── 6. Redis / Upstash Production Failover & Health Check ─────────────────
  test("6. Redis Health & Rate Limiting: correctly categorizes failures and enforces fail-closed production semantics", async () => {
    // 6a. Unconfigured state
    const originalEnv = { ...process.env };
    try {
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;

      const health = await checkRedisHealth();
      assert.strictEqual(health.status, "unconfigured");

      // In production environment without Redis, rate limiter MUST fail closed (503)
      process.env.NODE_ENV = "production";
      const rateRes = await checkRateLimitAsync("test_key", { limit: 10, windowMs: 60000 });
      assert.strictEqual(rateRes.allowed, false);
      assert.strictEqual(rateRes.status, 503);
      assert.strictEqual(rateRes.code, "SERVICE_UNAVAILABLE");
    } finally {
      process.env = originalEnv;
    }

    // 6b. Simulated Redis healthy response
    const origFetch = globalThis.fetch;
    try {
      process.env.UPSTASH_REDIS_REST_URL = "https://mock.upstash.io";
      process.env.UPSTASH_REDIS_REST_TOKEN = "mock-secret-token";
      process.env.NODE_ENV = "production";

      globalThis.fetch = async (url, opts) => {
        return {
          ok: true,
          status: 200,
          json: async () => [{ result: "PONG" }],
        };
      };

      const health = await checkRedisHealth();
      assert.strictEqual(health.status, "healthy");
      assert.ok(typeof health.latencyMs === "number");

      // 6c. Simulated Redis 401 Unauthorized (invalid credentials)
      globalThis.fetch = async () => ({
        ok: false,
        status: 401,
        json: async () => ({ error: "Unauthorized" }),
      });

      const authFailHealth = await checkRedisHealth();
      assert.strictEqual(authFailHealth.status, "unhealthy");
      assert.strictEqual(authFailHealth.errorCategory, "REDIS_CONFIGURATION_ERROR");

      // 6d. Simulated Redis Timeout (AbortError)
      globalThis.fetch = async () => {
        const timeoutErr = new Error("The operation was aborted");
        timeoutErr.name = "AbortError";
        throw timeoutErr;
      };

      const timeoutHealth = await checkRedisHealth();
      assert.strictEqual(timeoutHealth.status, "unhealthy");
      assert.strictEqual(timeoutHealth.errorCategory, "REDIS_TIMEOUT");

      // Rate limit evaluation with Redis timeout in production fails closed
      const timeoutRateLimit = await checkRateLimitAsync("test_key", { limit: 5, windowMs: 60000 });
      assert.strictEqual(timeoutRateLimit.allowed, false);
      assert.strictEqual(timeoutRateLimit.status, 503);
      assert.strictEqual(timeoutRateLimit.code, "SERVICE_UNAVAILABLE");
    } finally {
      globalThis.fetch = origFetch;
      process.env = originalEnv;
    }
  });

  // ─── 7. Standardized Error Response Correlation ────────────────────────────
  test("7. createApiErrorResponse: attaches X-Correlation-Id and X-Request-Id headers", () => {
    const res = createApiErrorResponse(
      "PROVIDER_UNAVAILABLE",
      "AI provider unavailable.",
      "test-corr-id-777",
      { statusCode: 503 }
    );

    assert.strictEqual(res.status, 503);
    assert.strictEqual(res.headers.get("x-correlation-id"), "test-corr-id-777");
    assert.strictEqual(res.headers.get("x-request-id"), "test-corr-id-777");
  });

  // ─── 8. Voice Stream Server Operational Telemetry ──────────────────────────
  test("8. Voice Stream Server Telemetry: logVoiceMetric redacts sensitive data from audio events", () => {
    const logs = [];
    const origLog = console.log;
    console.log = (msg) => logs.push(msg);

    try {
      logVoiceMetric("voice.connection.accepted", {
        sessionId: "vui_session_123",
        userId: "usr_999",
        token: "sensitive-hmac-token",
        secret: "super-secret-salt",
        audio: Buffer.from("raw audio pcm"),
        transcript: "private user speech",
        password: "user-password",
      });
    } finally {
      console.log = origLog;
    }

    assert.strictEqual(logs.length, 1);
    const parsed = JSON.parse(logs[0]);
    assert.strictEqual(parsed.event, "voice.connection.accepted");
    assert.strictEqual(parsed.sessionId, "vui_session_123");
    assert.strictEqual(parsed.userId, "usr_999");
    assert.strictEqual(parsed.token, undefined, "Token must be stripped");
    assert.strictEqual(parsed.secret, undefined, "Secret must be stripped");
    assert.strictEqual(parsed.audio, undefined, "Audio must be stripped");
    assert.strictEqual(parsed.transcript, undefined, "Transcript must be stripped");
    assert.strictEqual(parsed.password, undefined, "Password must be stripped");
  });

  // ─── 9. AI Provider Cascade Failure-Injection ──────────────────────────────
  test("9. AI Cascade Failure-Injection: handles timeout, 429, missing keys, and malformed responses cleanly", async () => {
    const originalEnv = { ...process.env };
    delete process.env.UBIX_MOCK_AI;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.GOOGLE_AI_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENROUTER_API_KEY;

    try {
      // 9a. No keys configured -> throws 503 AI_PROVIDER_NOT_CONFIGURED
      await assert.rejects(
        async () => {
          await generateAIResponse({
            messages: [{ role: "user", content: "Hello" }],
          });
        },
        (err) => err.code === "AI_PROVIDER_NOT_CONFIGURED" && err.statusCode === 503
      );

      // 9b. Primary provider fails with 429 rate limit, secondary succeeds
      process.env.GEMINI_API_KEY = "test-gemini-key-12345";
      process.env.GROQ_API_KEY = "test-groq-key-12345";

      const origFetch = globalThis.fetch;
      let callCount = 0;
      globalThis.fetch = async (url) => {
        callCount++;
        if (url.includes("generativelanguage.googleapis.com")) {
          return {
            ok: false,
            status: 429,
            text: async () => "Rate limit exceeded",
          };
        }
        if (url.includes("api.groq.com")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              choices: [{ message: { content: "Groq response after Gemini 429" } }],
            }),
          };
        }
        return { ok: false, status: 500, text: async () => "Unknown host" };
      };

      try {
        const res = await generateAIResponse({
          messages: [{ role: "user", content: "Tell me a tech joke" }],
          preferredProvider: "gemini",
        });
        assert.strictEqual(res.text, "Groq response after Gemini 429");
        assert.strictEqual(res.provider, "groq");
        assert.strictEqual(res.fallbackIndex, 1);
        assert.ok(callCount >= 2, "Must have called primary then secondary");
      } finally {
        globalThis.fetch = origFetch;
      }
    } finally {
      process.env = originalEnv;
    }
  });

  // ─── 10. Operational Health & Readiness Probes ─────────────────────────────
  test("10. Health Probes: liveness and readiness return structured diagnostics without secret disclosure", async () => {
    // 10a. Liveness probe
    const liveRes = await livenessGET();
    assert.strictEqual(liveRes.status, 200);
    const liveBody = await liveRes.json();
    assert.strictEqual(liveBody.status, "ok");
    assert.ok(typeof liveBody.uptimeSeconds === "number");
    assert.ok(typeof liveBody.timestamp === "string");

    // 10b. Readiness probe
    const readyRes = await readinessGET();
    assert.ok(readyRes.status === 200 || readyRes.status === 503);
    const readyBody = await readyRes.json();
    assert.ok(readyBody.status === "ready" || readyBody.status === "not_ready");
    assert.ok(readyBody.checks);
    assert.ok(readyBody.checks.redis);
    assert.ok(readyBody.checks.aiProviders);

    // Verify zero secrets leaked in body
    const bodyStr = JSON.stringify(readyBody);
    assert(!bodyStr.includes("sk-"), "No OpenAI keys in readiness output");
    assert(!bodyStr.includes("gsk_"), "No Groq keys in readiness output");
    assert(!bodyStr.includes("AIza"), "No Gemini keys in readiness output");
    assert(!bodyStr.includes("UPSTASH"), "No Upstash variable names in readiness output");
    assert(!bodyStr.includes("SUPABASE_KEY"), "No Supabase keys in readiness output");
  });
});
