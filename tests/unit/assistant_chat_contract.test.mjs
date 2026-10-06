/**
 * tests/unit/assistant_chat_contract.test.mjs
 *
 * Verifies runtime HTTP contract of /api/assistant/chat and /api/assistant/status.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../../app/api/assistant/chat/route.ts";
import { GET as getStatus } from "../../app/api/assistant/status/route.ts";
const NextRequest = globalThis.Request;
import { createSignedSessionToken } from "../../lib/security/session.ts";

const testAuthCookie = `cf_session=${createSignedSessionToken({
  userId: "test-user-contract-123",
  email: "contract-test@ubix.internal",
  role: "authenticated",
})}`;

test("API Contract: /api/assistant/chat returns 503 AI_PROVIDER_NOT_CONFIGURED when GEMINI_API_KEY is absent", async () => {
  const origKey = process.env.GEMINI_API_KEY;
  const origOpenai = process.env.OPENAI_API_KEY;
  const origMock = process.env.UBIX_MOCK_AI;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  delete process.env.GOOGLE_AI_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.UBIX_MOCK_AI;

  try {
    const req = new NextRequest("http://localhost:3000/api/assistant/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: testAuthCookie,
      },
      body: JSON.stringify({
        messages: [{ role: "user", text: "Hello" }],
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 503, "Status must be 503 when no key is configured");

    const json = await res.json();
    assert.equal(json.ok, false);
    assert.equal(json.error?.code, "AI_PROVIDER_NOT_CONFIGURED");
    assert.equal(
      json.error?.message,
      "AI assistant is temporarily unavailable because no AI provider is configured."
    );
    // Ensure no fake AI reply was returned
    assert.equal(json.reply, undefined);
  } finally {
    if (origKey !== undefined) process.env.GEMINI_API_KEY = origKey;
    if (origOpenai !== undefined) process.env.OPENAI_API_KEY = origOpenai;
    if (origMock !== undefined) process.env.UBIX_MOCK_AI = origMock;
  }
});

test("API Contract: /api/assistant/chat executes turn with mock provider when UBIX_MOCK_AI is enabled", async () => {
  const origMock = process.env.UBIX_MOCK_AI;
  process.env.UBIX_MOCK_AI = "true";

  try {
    const req = new NextRequest("http://localhost:3000/api/assistant/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: testAuthCookie,
      },
      body: JSON.stringify({
        messages: [{ role: "user", text: "What should I work on today?" }],
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 200, "Mock provider must return 200");

    const json = await res.json();
    assert.equal(json.isFallback, false);
    assert(json.reply?.includes("UBIX_MOCK_ASSISTANT_OK"));
  } finally {
    if (origMock !== undefined) process.env.UBIX_MOCK_AI = origMock;
    else delete process.env.UBIX_MOCK_AI;
  }
});

test("API Contract: /api/assistant/status returns provider metadata without leaking keys or tokens", async () => {
  const res = await getStatus();
  assert.equal(res.status, 200);

  const json = await res.json();
  assert.equal(json.ok, true);
  assert.equal(json.provider, "openai");
  assert.equal(typeof json.configured, "boolean");
  assert.equal(json.model, "gpt-4o-mini");

  const raw = JSON.stringify(json);
  assert(!raw.includes("AQ."), "No secret key prefix");
  assert(!raw.includes("sk-"), "No secret key prefix");
  assert(!raw.includes("Bearer"), "No bearer token");
});

test("API Contract: UBIX_MOCK_AI is strictly ignored when NODE_ENV is production", async () => {
  const origMock = process.env.UBIX_MOCK_AI;
  const origNodeEnv = process.env.NODE_ENV;
  const origOpenAiKey = process.env.OPENAI_API_KEY;
  const origGeminiKey = process.env.GEMINI_API_KEY;
  const origSecret = process.env.SESSION_SECRET;

  delete process.env.OPENAI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  delete process.env.GOOGLE_AI_KEY;
  process.env.UBIX_MOCK_AI = "true";
  process.env.NODE_ENV = "production";
  process.env.SESSION_SECRET = origSecret || "test-production-secret-must-be-at-least-32-chars-long";

  // Regenerate session cookie using the explicit secret
  const prodAuthCookie = `cf_session=${createSignedSessionToken({
    userId: "test-user-contract-123",
    email: "contract-test@ubix.internal",
    role: "authenticated",
  })}`;

  try {
    const req = new NextRequest("http://localhost:3000/api/assistant/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: prodAuthCookie,
      },
      body: JSON.stringify({
        messages: [{ role: "user", text: "Hello in production" }],
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 503, "Production must ignore mock mode and fail closed with 503");
    const json = await res.json();
    assert.equal(json.ok, false);
    assert.equal(json.error?.code, "AI_PROVIDER_NOT_CONFIGURED");
  } finally {
    if (origMock !== undefined) process.env.UBIX_MOCK_AI = origMock;
    else delete process.env.UBIX_MOCK_AI;
    if (origNodeEnv !== undefined) process.env.NODE_ENV = origNodeEnv;
    else delete process.env.NODE_ENV;
    if (origOpenAiKey !== undefined) process.env.OPENAI_API_KEY = origOpenAiKey;
    else delete process.env.OPENAI_API_KEY;
    if (origGeminiKey !== undefined) process.env.GEMINI_API_KEY = origGeminiKey;
    else delete process.env.GEMINI_API_KEY;
    if (origSecret !== undefined) process.env.SESSION_SECRET = origSecret;
    else delete process.env.SESSION_SECRET;
  }
});
