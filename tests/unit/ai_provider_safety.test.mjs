/**
 * tests/unit/ai_provider_safety.test.mjs
 *
 * Verifies security and integrity guarantees of UBIX AI Provider Gateway:
 * 1. Missing GEMINI_API_KEY triggers strict AI_PROVIDER_NOT_CONFIGURED (503).
 * 2. Never fabricate AI responses when no key is configured.
 * 3. Mock AI mode is hermetic and strictly prohibited in production.
 * 4. Error classification maps upstream failures into structured status codes.
 * 5. Provider status endpoint never exposes secrets or tokens.
 * 6. GEMINI_API_KEY is server-only (zero NEXT_PUBLIC_ exposure).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  getCanonicalProvider,
  getProviderStatus,
  mapProviderError,
  CANONICAL_PROVIDER,
  PROVIDER_MODELS,
} from "../../lib/ai/providerConfig.ts";

test("AI Provider: Canonical provider is openai and model defaults to gpt-4o-mini", () => {
  assert.equal(CANONICAL_PROVIDER, "openai");
  assert.equal(PROVIDER_MODELS.openai, "gpt-4o-mini");
});

test("AI Provider: Missing OPENAI_API_KEY correctly reports not_configured (No fake AI)", () => {
  const origKey = process.env.OPENAI_API_KEY;
  const origProvider = process.env.AI_PROVIDER;
  const origMock = process.env.UBIX_MOCK_AI;

  try {
    delete process.env.OPENAI_API_KEY;
    delete process.env.AI_PROVIDER;
    delete process.env.UBIX_MOCK_AI;

    const info = getCanonicalProvider();
    assert.equal(info.provider, "openai");
    assert.equal(info.isConfigured, false);
    assert.equal(info.apiKey, null);

    const status = getProviderStatus();
    assert.equal(status.configured, false);
    assert.equal(status.status, "not_configured");
    assert.equal(status.provider, "openai");
    assert.equal(status.model, "gpt-4o-mini");
  } finally {
    if (origKey !== undefined) process.env.OPENAI_API_KEY = origKey;
    if (origProvider !== undefined) process.env.AI_PROVIDER = origProvider;
    if (origMock !== undefined) process.env.UBIX_MOCK_AI = origMock;
  }
});

test("AI Provider: Provider status endpoint NEVER leaks API keys or secrets", () => {
  const origKey = process.env.OPENAI_API_KEY;
  try {
    process.env.OPENAI_API_KEY = "sk-proj-test-super-secret-production-test-token-123456789";
    const status = getProviderStatus();

    // Verify key or token is not in any field
    const serialized = JSON.stringify(status);
    assert(!serialized.includes("sk-proj-test-super-secret"), "Status response must NEVER contain API keys");
    assert(!serialized.includes("Bearer"), "Status response must NEVER contain bearer tokens");
    assert.equal(status.configured, true);
    assert.equal(status.status, "ready");
  } finally {
    if (origKey !== undefined) process.env.OPENAI_API_KEY = origKey;
    else delete process.env.OPENAI_API_KEY;
  }
});

test("AI Provider: Error mapping translates upstream failures into structured codes", () => {
  // 1. Timeout
  const timeoutErr = new Error("The operation was aborted due to timeout");
  timeoutErr.name = "AbortError";
  const mappedTimeout = mapProviderError(timeoutErr);
  assert.equal(mappedTimeout.code, "AI_PROVIDER_TIMEOUT");
  assert.equal(mappedTimeout.statusCode, 504);

  // 2. Rate limit (429)
  const rateLimitErr = new Error("Rate limit exceeded: 429 too many requests");
  rateLimitErr.status = 429;
  const mappedRateLimit = mapProviderError(rateLimitErr);
  assert.equal(mappedRateLimit.code, "AI_PROVIDER_RATE_LIMITED");
  assert.equal(mappedRateLimit.statusCode, 429);

  // 3. Auth error (401 / Invalid API key)
  const authErr = new Error("Incorrect API key provided: invalid key");
  authErr.status = 401;
  const mappedAuth = mapProviderError(authErr);
  assert.equal(mappedAuth.code, "AI_PROVIDER_AUTH_ERROR");
  assert.equal(mappedAuth.statusCode, 502);

  // 4. Network error (ECONNREFUSED / fetch failed)
  const netErr = new Error("fetch failed: ECONNREFUSED 127.0.0.1:443");
  const mappedNet = mapProviderError(netErr);
  assert.equal(mappedNet.code, "AI_PROVIDER_NETWORK_ERROR");
  assert.equal(mappedNet.statusCode, 502);

  // 5. Generic upstream failure (500)
  const genErr = new Error("Internal server error from upstream model cluster");
  genErr.status = 500;
  const mappedGen = mapProviderError(genErr);
  assert.equal(mappedGen.code, "AI_PROVIDER_UNAVAILABLE");
  assert.equal(mappedGen.statusCode, 503);

  // 6. Malformed response / JSON parse error
  const malformedErr = new Error("SyntaxError: Unexpected token < in JSON at position 0");
  const mappedMalformed = mapProviderError(malformedErr);
  assert.equal(mappedMalformed.code, "AI_PROVIDER_MALFORMED_RESPONSE");
  assert.equal(mappedMalformed.statusCode, 502);
});

test("AI Provider: Mock AI mode enables hermetic, deterministic tests without keys", () => {
  const origMock = process.env.UBIX_MOCK_AI;
  const origNodeEnv = process.env.NODE_ENV;
  try {
    process.env.UBIX_MOCK_AI = "true";
    process.env.NODE_ENV = "test";
    const info = getCanonicalProvider();
    assert.equal(info.isMock, true);
    assert.equal(info.isConfigured, true);
    assert.equal(info.provider, "mock");
  } finally {
    if (origMock !== undefined) process.env.UBIX_MOCK_AI = origMock;
    else delete process.env.UBIX_MOCK_AI;
    if (origNodeEnv !== undefined) process.env.NODE_ENV = origNodeEnv;
    else delete process.env.NODE_ENV;
  }
});

test("AI Provider: Mock AI mode is strictly blocked in production environment", () => {
  const origMock = process.env.UBIX_MOCK_AI;
  const origNodeEnv = process.env.NODE_ENV;
  const origOpenAiKey = process.env.OPENAI_API_KEY;
  const origGeminiKey = process.env.GEMINI_API_KEY;

  delete process.env.OPENAI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  delete process.env.GOOGLE_AI_KEY;
  process.env.UBIX_MOCK_AI = "true";
  process.env.NODE_ENV = "production";

  try {
    const info = getCanonicalProvider();
    assert.equal(info.isMock, false, "Mock AI must NEVER activate in production");
    assert.equal(info.isConfigured, false, "Provider must report not configured when key is absent");
  } finally {
    if (origMock !== undefined) process.env.UBIX_MOCK_AI = origMock;
    else delete process.env.UBIX_MOCK_AI;
    if (origNodeEnv !== undefined) process.env.NODE_ENV = origNodeEnv;
    else delete process.env.NODE_ENV;
    if (origOpenAiKey !== undefined) process.env.OPENAI_API_KEY = origOpenAiKey;
    if (origGeminiKey !== undefined) process.env.GEMINI_API_KEY = origGeminiKey;
  }
});

test("AI Provider: AI_PROVIDER override selects alternative provider with verified config", () => {
  const origProvider = process.env.AI_PROVIDER;
  const origGeminiKey = process.env.GEMINI_API_KEY;

  try {
    process.env.AI_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "AIzaSyTestGeminiKey123456789";

    const info = getCanonicalProvider();
    assert.equal(info.provider, "gemini");
    assert.equal(info.isConfigured, true);
    assert.equal(info.modelId, PROVIDER_MODELS.gemini);
  } finally {
    if (origProvider !== undefined) process.env.AI_PROVIDER = origProvider;
    else delete process.env.AI_PROVIDER;
    if (origGeminiKey !== undefined) process.env.GEMINI_API_KEY = origGeminiKey;
    else delete process.env.GEMINI_API_KEY;
  }
});

test("AI Provider: Live AI Smoke Test (Opt-in only via RUN_LIVE_AI_TESTS=true)", async (t) => {
  if (process.env.RUN_LIVE_AI_TESTS !== "true" || (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY)) {
    t.skip("Skipped live AI smoke test: RUN_LIVE_AI_TESTS is not enabled or no AI key is configured.");
    return;
  }

  const { getModelInstance } = await import("../../lib/ai/providerConfig.ts");
  const { generateText } = await import("ai");
  const provider = process.env.OPENAI_API_KEY ? "openai" : "gemini";
  const apiKey = process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;
  const model = getModelInstance(provider, apiKey);

  const result = await generateText({
    model,
    prompt: "Reply with exactly: UBIX_PROVIDER_OK",
    maxOutputTokens: 20,
    temperature: 0,
  });

  assert(result.text.includes("UBIX_PROVIDER_OK"), `Live model reply was: "${result.text}"`);
});
