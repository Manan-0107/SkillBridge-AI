/**
 * tests/unit/phase3_6_1_rate_limit.test.mjs
 *
 * Phase 3.6.1 — Production Rate-Limit Enforcement Test Suite
 *
 * Validates:
 * 1. Development without Redis → in-memory limiter works.
 * 2. Test environment without Redis → tests continue working.
 * 3. Production without Redis → request is rejected safely (fail-closed HTTP 503).
 * 4. Production with Redis configuration → distributed limiter path is used.
 * 5. Rate-limit infrastructure failure cannot silently become "unlimited requests".
 * 6. No secret/configuration values appear in response bodies or logs.
 * 7. Middleware integration respects fail-closed 503 vs 429 status semantics.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkRateLimit,
  checkRateLimitAsync,
  _resetRateLimitStore,
  RATE_LIMIT_POLICIES,
} from "../../lib/security/rateLimit.ts";

// Helper to safely run with isolated environment variables
async function withIsolatedEnv(envUpdates, fn) {
  const savedEnv = {};
  for (const key of Object.keys(envUpdates)) {
    savedEnv[key] = process.env[key];
    const val = envUpdates[key];
    if (val === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = val;
    }
  }

  try {
    return await fn();
  } finally {
    for (const key of Object.keys(savedEnv)) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
  }
}

// ─── 1. Development without Redis → in-memory limiter works ───────────────────
test("Phase 3.6.1: 1. Development without Redis uses in-memory sliding window limiter", async () => {
  await withIsolatedEnv(
    {
      NODE_ENV: "development",
      VERCEL_ENV: undefined,
      UPSTASH_REDIS_REST_URL: undefined,
      UPSTASH_REDIS_REST_TOKEN: undefined,
    },
    async () => {
      _resetRateLimitStore();
      const testKey = `dev_test_${Date.now()}`;
      const config = { limit: 2, windowMs: 10000 };

      // Request 1: allowed
      const res1 = await checkRateLimitAsync(testKey, config);
      assert.equal(res1.allowed, true);
      assert.equal(res1.isLimited, false);
      assert.equal(res1.remaining, 1);

      // Request 2: allowed
      const res2 = await checkRateLimitAsync(testKey, config);
      assert.equal(res2.allowed, true);
      assert.equal(res2.isLimited, false);
      assert.equal(res2.remaining, 0);

      // Request 3: blocked (in-memory rate limit exceeded)
      const res3 = await checkRateLimitAsync(testKey, config);
      assert.equal(res3.allowed, false);
      assert.equal(res3.isLimited, true);
      assert.equal(res3.status, 429);
      assert.equal(res3.remaining, 0);
    }
  );
});

// ─── 2. Test environment without Redis → tests continue working ───────────────
test("Phase 3.6.1: 2. Test environment without Redis operates deterministically", async () => {
  await withIsolatedEnv(
    {
      NODE_ENV: "test",
      VERCEL_ENV: undefined,
      UPSTASH_REDIS_REST_URL: undefined,
      UPSTASH_REDIS_REST_TOKEN: undefined,
    },
    async () => {
      _resetRateLimitStore();
      const syncKey = `test_sync_${Date.now()}`;
      const asyncKey = `test_async_${Date.now()}`;
      const config = { limit: 1, windowMs: 5000 };

      // Synchronous checkRateLimit in test env
      const sync1 = checkRateLimit(syncKey, config);
      assert.equal(sync1.allowed, true);
      assert.equal(sync1.isLimited, false);

      const sync2 = checkRateLimit(syncKey, config);
      assert.equal(sync2.allowed, false);
      assert.equal(sync2.isLimited, true);
      assert.equal(sync2.status, 429);

      // Asynchronous checkRateLimitAsync in test env
      const async1 = await checkRateLimitAsync(asyncKey, config);
      assert.equal(async1.allowed, true);
      assert.equal(async1.isLimited, false);

      const async2 = await checkRateLimitAsync(asyncKey, config);
      assert.equal(async2.allowed, false);
      assert.equal(async2.isLimited, true);
      assert.equal(async2.status, 429);
    }
  );
});

// ─── 3. Production without Redis → request is rejected safely ─────────────────
test("Phase 3.6.1: 3. Production without Redis strictly fails closed with HTTP 503", async () => {
  await withIsolatedEnv(
    {
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      UPSTASH_REDIS_REST_URL: undefined,
      UPSTASH_REDIS_REST_TOKEN: undefined,
    },
    async () => {
      const prodKey = `prod_test_${Date.now()}`;
      const config = RATE_LIMIT_POLICIES.PUBLIC_API;

      // Async check in production without Redis credentials: must fail closed with 503
      const asyncRes = await checkRateLimitAsync(prodKey, config);
      assert.equal(asyncRes.allowed, false, "Must not allow request without distributed limiter");
      assert.equal(asyncRes.isLimited, true, "Must flag as limited");
      assert.equal(asyncRes.status, 503, "Must return HTTP 503 status code");
      assert.equal(asyncRes.code, "SERVICE_UNAVAILABLE");
      assert.equal(asyncRes.remaining, 0);

      // Synchronous check in production: must also fail closed with 503 to prevent silent local bypass
      const syncRes = checkRateLimit(prodKey, config);
      assert.equal(syncRes.allowed, false, "Synchronous check in production must fail closed");
      assert.equal(syncRes.isLimited, true);
      assert.equal(syncRes.status, 503);
      assert.equal(syncRes.code, "SERVICE_UNAVAILABLE");
    }
  );
});

// ─── 4. Production with Redis configuration → distributed limiter path is used ─
test("Phase 3.6.1: 4. Production with Redis configuration uses distributed limiter path", async () => {
  const origFetch = globalThis.fetch;
  let interceptedUrl = null;
  let interceptedAuth = null;
  let interceptedBody = null;
  let mockPipelineResponse = [{ result: 5 }, { result: 1 }, { result: 42000 }];

  globalThis.fetch = async (url, options) => {
    interceptedUrl = String(url);
    interceptedAuth = options?.headers?.Authorization;
    interceptedBody = JSON.parse(options?.body || "[]");

    return {
      ok: true,
      status: 200,
      json: async () => mockPipelineResponse,
    };
  };

  try {
    await withIsolatedEnv(
      {
        NODE_ENV: "production",
        VERCEL_ENV: "production",
        UPSTASH_REDIS_REST_URL: "https://mock-distributed-redis.upstash.io",
        UPSTASH_REDIS_REST_TOKEN: "mock-production-secret-token",
      },
      async () => {
        const key = "user:prod-12345:chat";
        const config = { limit: 10, windowMs: 60000 };

        // Test under-limit response from Redis (current count = 5, limit = 10)
        mockPipelineResponse = [{ result: 5 }, { result: 1 }, { result: 42000 }];
        const resAllowed = await checkRateLimitAsync(key, config);

        assert.equal(resAllowed.allowed, true);
        assert.equal(resAllowed.isLimited, false);
        assert.equal(resAllowed.status, 200);
        assert.equal(resAllowed.remaining, 5); // 10 - 5
        assert.equal(resAllowed.resetMs, 42000);

        // Verify Redis pipeline wire protocol
        assert.equal(interceptedUrl, "https://mock-distributed-redis.upstash.io/pipeline");
        assert.equal(interceptedAuth, "Bearer mock-production-secret-token");
        assert.deepEqual(interceptedBody[0], ["INCR", key]);
        assert.deepEqual(interceptedBody[1], ["PEXPIRE", key, 60000, "NX"]);
        assert.deepEqual(interceptedBody[2], ["PTTL", key]);

        // Test over-limit response from Redis (current count = 15, limit = 10)
        mockPipelineResponse = [{ result: 15 }, { result: 1 }, { result: 35000 }];
        const resLimited = await checkRateLimitAsync(key, config);

        assert.equal(resLimited.allowed, false);
        assert.equal(resLimited.isLimited, true);
        assert.equal(resLimited.status, 429);
        assert.equal(resLimited.remaining, 0);
        assert.equal(resLimited.resetMs, 35000);
      }
    );
  } finally {
    globalThis.fetch = origFetch;
  }
});

// ─── 5. Infrastructure failure cannot silently become "unlimited requests" ─────
test("Phase 3.6.1: 5. Redis infrastructure failure strictly fails closed with 503", async () => {
  const origFetch = globalThis.fetch;

  try {
    await withIsolatedEnv(
      {
        NODE_ENV: "production",
        VERCEL_ENV: "production",
        UPSTASH_REDIS_REST_URL: "https://mock-redis.upstash.io",
        UPSTASH_REDIS_REST_TOKEN: "mock-token",
      },
      async () => {
        const key = "user:outage:test";
        const config = { limit: 5, windowMs: 30000 };

        // Scenario A: Network error / connection timeout
        globalThis.fetch = async () => {
          throw new Error("Connection refused to Redis cluster");
        };

        const resNetError = await checkRateLimitAsync(key, config);
        assert.equal(resNetError.allowed, false, "Network failure must not grant unlimited requests");
        assert.equal(resNetError.isLimited, true);
        assert.equal(resNetError.status, 503, "Must fail closed with HTTP 503");
        assert.equal(resNetError.code, "SERVICE_UNAVAILABLE");

        // Scenario B: Redis cluster returns HTTP 500 error
        globalThis.fetch = async () => ({
          ok: false,
          status: 500,
          json: async () => ({ error: "Internal Redis Engine Error" }),
        });

        const resHttp500 = await checkRateLimitAsync(key, config);
        assert.equal(resHttp500.allowed, false, "HTTP 500 from Redis must not grant unlimited access");
        assert.equal(resHttp500.isLimited, true);
        assert.equal(resHttp500.status, 503);
        assert.equal(resHttp500.code, "SERVICE_UNAVAILABLE");
      }
    );
  } finally {
    globalThis.fetch = origFetch;
  }
});

// ─── 6. No secret/configuration values appear in response bodies or logs ───────
test("Phase 3.6.1: 6. No secret or environment variable names exposed in response bodies or logs", async () => {
  const secretToken = "shhh-super-secret-token-xyz-98765";
  const redisEndpoint = "https://sensitive-endpoint.upstash.io";

  const origError = console.error;
  const origWarn = console.warn;
  const loggedMessages = [];

  console.error = (...args) => {
    loggedMessages.push(args.join(" "));
  };
  console.warn = (...args) => {
    loggedMessages.push(args.join(" "));
  };

  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error(`Failed to reach ${redisEndpoint}`);
  };

  try {
    await withIsolatedEnv(
      {
        NODE_ENV: "production",
        VERCEL_ENV: "production",
        UPSTASH_REDIS_REST_URL: redisEndpoint,
        UPSTASH_REDIS_REST_TOKEN: secretToken,
      },
      async () => {
        const res = await checkRateLimitAsync("test:leak_check", { limit: 10, windowMs: 1000 });

        // 1. Check response payload
        const resJson = JSON.stringify(res);
        assert(!resJson.includes(secretToken), "Response must not contain secret token");
        assert(!resJson.includes("UPSTASH_REDIS"), "Response must not expose env variable names");
        assert(!resJson.includes(redisEndpoint), "Response must not expose Redis URL");

        // 2. Check all logged messages
        const allLogs = loggedMessages.join("\n");
        assert(!allLogs.includes(secretToken), "Logs must not contain secret token");
        assert(!allLogs.includes("UPSTASH_REDIS_REST_TOKEN"), "Logs must not mention token variable name");
        assert(!allLogs.includes("UPSTASH_REDIS_REST_URL"), "Logs must not mention URL variable name");
        assert(!allLogs.includes(redisEndpoint), "Logs must not contain raw Redis host/endpoint");
      }
    );
  } finally {
    globalThis.fetch = origFetch;
    console.error = origError;
    console.warn = origWarn;
  }
});

// ─── 7. Middleware integration: enforces fail-closed 503 vs 429 ───────────────
test("Phase 3.6.1: 7. Middleware returns 503 for rate-limited routes in production without Redis", async () => {
  const { middleware } = await import("../../middleware.ts");
  const { NextRequest } = await import("next/server");

  await withIsolatedEnv(
    {
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      UPSTASH_REDIS_REST_URL: undefined,
      UPSTASH_REDIS_REST_TOKEN: undefined,
    },
    async () => {
      // Unauthenticated request to /api/assistant/chat (public accessibility route)
      const anonAssistantReq = new NextRequest("http://careerforge.app/api/assistant/chat", {
        method: "POST",
        headers: {
          host: "careerforge.app",
          origin: "http://careerforge.app",
          "x-forwarded-for": "203.0.113.195",
        },
      });

      const res = await middleware(anonAssistantReq);
      assert.equal(res.status, 503, "Middleware must return HTTP 503 in production without Redis");

      const body = await res.json();
      assert.equal(body.code, "SERVICE_UNAVAILABLE");
      assert.equal(body.message, "Service temporarily unavailable. Please try again shortly.");
      assert.equal(res.headers.get("Retry-After"), "60");
    }
  );
});

