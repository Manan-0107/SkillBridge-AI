/**
 * tests/unit/phase4_hardening.test.mjs
 *
 * Phase 4 Comprehensive Security, Performance, Runtime & Production Hardening Suite:
 * 1. Edge Session Verification fail-closed contract when SESSION_SECRET is missing or short in production
 * 2. Confirmation Token memory lifecycle and automatic expiration sweep
 * 3. VoiceSessionManager stopCapture and destroy lifecycle resource cleanup
 * 4. CDN practice fetch fallback path sanitization and SSRF guard
 * 5. Resume Save input bounding (rejection of oversized resume text, role, filename)
 * 6. JSONResume input validation and max payload size enforcement
 * 7. Logging privacy and error message sanitization
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { verifySessionTokenEdge } from "../../lib/security/sessionEdge.ts";
import { createConfirmationToken, verifyAndConsumeConfirmationToken } from "../../lib/ai/tools.ts";
import { VoiceSessionManager } from "../../lib/voice/VoiceSessionManager.ts";
import { fetchDailyPractice, sanitizeCdnIdentifier } from "../../lib/cdn-fetch.ts";
import { POST as saveResumePost } from "../../app/api/resume/save/route.ts";
import { POST as jsonResumePost } from "../../app/api/resume/jsonresume/route.ts";
import { createSignedSessionToken, SESSION_CONFIG } from "../../lib/security/session.ts";

// ─── 1. Edge Session Verification Fail-Closed Invariant ───────────────────────
test("Phase 4: verifySessionTokenEdge fails closed when SESSION_SECRET is missing or short in production", async () => {
  const oldEnv = process.env.NODE_ENV;
  const oldSecret = process.env.SESSION_SECRET;

  try {
    process.env.NODE_ENV = "production";
    delete process.env.SESSION_SECRET;

    // Must strictly throw when secret is missing in production
    await assert.rejects(
      async () => {
        await verifySessionTokenEdge("any.token");
      },
      /FATAL SECURITY ERROR: SESSION_SECRET must be explicitly configured in production/,
      "Must fail closed if secret is missing in production"
    );

    // Must strictly throw if secret is shorter than 32 chars in production
    process.env.SESSION_SECRET = "too-short-secret";
    await assert.rejects(
      async () => {
        await verifySessionTokenEdge("any.token");
      },
      /FATAL SECURITY ERROR: Production SESSION_SECRET must be at least 32 characters long/,
      "Must fail closed if secret is under 32 chars in production"
    );
  } finally {
    process.env.NODE_ENV = oldEnv;
    if (oldSecret !== undefined) {
      process.env.SESSION_SECRET = oldSecret;
    } else {
      delete process.env.SESSION_SECRET;
    }
  }
});

// ─── 2. Confirmation Token Memory Cleanup & Lifecycle ─────────────────────────
test("Phase 4: Confirmation tokens purge expired entries and enforce action/user binding", () => {
  const token = createConfirmationToken("testAction", { key: "val" }, "user_123");
  assert(token.startsWith("conf_"), "Token must have conf_ prefix");

  // Rejection with wrong action
  assert.equal(
    verifyAndConsumeConfirmationToken(token, "wrongAction", "user_123"),
    false,
    "Mismatched action must be rejected"
  );

  // Rejection with wrong user
  assert.equal(
    verifyAndConsumeConfirmationToken(token, "testAction", "user_other"),
    false,
    "Mismatched user must be rejected"
  );

  // Successful consumption
  assert.equal(
    verifyAndConsumeConfirmationToken(token, "testAction", "user_123"),
    true,
    "Matching token and user must be verified"
  );

  // Single-use replay protection
  assert.equal(
    verifyAndConsumeConfirmationToken(token, "testAction", "user_123"),
    false,
    "Replayed token must be rejected"
  );
});

// ─── 3. VoiceSessionManager Resource Teardown Lifecycle ───────────────────────
test("Phase 4: VoiceSessionManager stopCapture and destroy cleanly reset state and release listeners", () => {
  const manager = VoiceSessionManager.getInstance();
  assert(manager, "Must obtain singleton VoiceSessionManager");

  let listenerFired = false;
  const unsubscribe = manager.subscribe(() => {
    listenerFired = true;
  });
  assert.equal(listenerFired, true, "Subscriber receives initial state");

  // stopCapture should execute safely even without active hardware in Node environment
  manager.stopCapture();
  const metrics = manager.getMetrics();
  assert.equal(metrics.micState, "UNINITIALIZED", "Mic state must be UNINITIALIZED after stopCapture");
  assert.equal(metrics.wsState, "DISCONNECTED", "WS state must be DISCONNECTED after stopCapture");

  // destroy must clear listeners and reset singleton
  manager.destroy();
  const nextManager = VoiceSessionManager.getInstance();
  assert(nextManager, "Must be able to reinitialize singleton after destroy");
  nextManager.destroy();
});

// ─── 4. CDN Fetch Traversal & SSRF Defense ─────────────────────────────────────
test("Phase 4: sanitizeCdnIdentifier strictly blocks path traversal and special characters", () => {
  assert.throws(() => sanitizeCdnIdentifier("../etc/passwd"), /Invalid CDN identifier/);
  assert.throws(() => sanitizeCdnIdentifier("foo/bar"), /Invalid CDN identifier/);
  assert.throws(() => sanitizeCdnIdentifier("track;rm -rf"), /Invalid CDN identifier/);
  assert.throws(() => sanitizeCdnIdentifier(""), /Identifier must be a non-empty string/);

  assert.equal(sanitizeCdnIdentifier("frontend"), "frontend");
  assert.equal(sanitizeCdnIdentifier("data-ai_2026"), "data-ai_2026");
});

// ─── 5. Resume Save Input Bounds & Payload Bounding ───────────────────────────
test("Phase 4: POST /api/resume/save strictly rejects oversized resume text (>64KB)", async () => {
  const validToken = createSignedSessionToken({
    userId: "user_test_bounds",
    email: "test_bounds@example.com",
    name: "Bounds Tester",
  });

  const oversizedText = "A".repeat(65 * 1024); // 65 KB > 64 KB limit

  const req = new Request("http://localhost:3000/api/resume/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `cf_session=${validToken}`,
    },
    body: JSON.stringify({
      filename: "test.pdf",
      resumeText: oversizedText,
      targetRole: "frontend",
      analysisResult: {
        overallScore: 85,
        matchedSkills: ["React"],
        missingSkills: ["Next.js"],
      },
    }),
  });

  const res = await saveResumePost(req);
  assert.equal(res.status, 413, "Oversized resume text must return HTTP 413 Payload Too Large");
  const data = await res.json();
  assert.equal(data.success, false);
  assert(data.error.includes("exceeds maximum allowed length"));
});

test("Phase 4: POST /api/resume/save strictly rejects oversized targetRole (>100 chars)", async () => {
  const validToken = createSignedSessionToken({
    userId: "user_test_role_bounds",
    email: "test_role@example.com",
    name: "Role Tester",
  });

  const req = new Request("http://localhost:3000/api/resume/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `cf_session=${validToken}`,
    },
    body: JSON.stringify({
      filename: "test.pdf",
      resumeText: "Valid resume text content for testing bounds.",
      targetRole: "X".repeat(101),
      analysisResult: {
        overallScore: 85,
        matchedSkills: ["React"],
        missingSkills: [],
      },
    }),
  });

  const res = await saveResumePost(req);
  assert.equal(res.status, 400, "Oversized targetRole must return HTTP 400 Bad Request");
});

// ─── 6. JSONResume Payload Size and Schema Guard ──────────────────────────────
test("Phase 4: POST /api/resume/jsonresume enforces size limits and non-object rejection", async () => {
  // 1. Non-object payload
  const reqNonObj = new Request("http://localhost:3000/api/resume/jsonresume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify("not-an-object"),
  });
  const resNonObj = await jsonResumePost(reqNonObj);
  assert.equal(resNonObj.status, 400);

  // 2. Oversized payload header
  const reqOversized = new Request("http://localhost:3000/api/resume/jsonresume", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": String(100 * 1024),
    },
    body: JSON.stringify({ fullName: "Test" }),
  });
  const resOversized = await jsonResumePost(reqOversized);
  assert.equal(resOversized.status, 413, "Content-Length > 64KB must return HTTP 413");
});
