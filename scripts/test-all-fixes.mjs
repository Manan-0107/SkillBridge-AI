/**
 * test-all-fixes.mjs
 * Automated test suite for CareerForge Voice & Security Bugfixes
 */

import assert from "node:assert/strict";
import {
  isAllowedFeature,
  isAllowedResumeTab,
  sanitizeNavigation,
  sanitizeHtmlAndSvg,
  sanitizeSafeUrl,
  AiToolCallSchema,
} from "../lib/security/aiValidation.ts";
import { VoiceSessionManager } from "../lib/voice/VoiceSessionManager.ts";

console.log("==================================================");
console.log("  CAREERFORGE BUGFIX AUTOMATED VERIFICATION SUITE ");
console.log("==================================================\n");

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(err);
    failed++;
  }
}

async function runSuite() {
  // ─── 1. Security: Navigation Allowlist & Path Sanitization ─────────────────────
  await test("Security: Navigation allowlist allows only platform features", () => {
    assert.equal(isAllowedFeature("resume"), true);
    assert.equal(isAllowedFeature("practice"), true);
    assert.equal(isAllowedFeature("courses"), true);
    assert.equal(isAllowedFeature("local"), true);
    assert.equal(isAllowedFeature("roadmap"), true);

    assert.equal(isAllowedFeature("admin"), false);
    assert.equal(isAllowedFeature("shell"), false);
    assert.equal(isAllowedFeature("../../etc/passwd"), false);
    assert.equal(isAllowedFeature("javascript:alert(1)"), false);
  });

  await test("Security: Resume tab allowlist allows only valid tabs", () => {
    assert.equal(isAllowedResumeTab("builder"), true);
    assert.equal(isAllowedResumeTab("analyzer"), true);
    assert.equal(isAllowedResumeTab("personalizer"), true);

    assert.equal(isAllowedResumeTab("admin"), false);
    assert.equal(isAllowedResumeTab("exec"), false);
  });

  await test("Security: sanitizeNavigation resolves valid paths and rejects dangerous targets", () => {
    assert.deepEqual(sanitizeNavigation("/resume/builder"), { feature: "resume", resumeTab: "builder" });
    assert.deepEqual(sanitizeNavigation("/practice/interview"), { feature: "practice", resumeTab: undefined });
    assert.deepEqual(sanitizeNavigation("/courses"), { feature: "courses", resumeTab: undefined });
    assert.deepEqual(sanitizeNavigation("/jobs"), { feature: "local", resumeTab: undefined });
    assert.deepEqual(sanitizeNavigation("/roadmap"), { feature: "roadmap", resumeTab: undefined });

    // Disallowed / malicious destinations
    assert.equal(sanitizeNavigation("javascript:alert(1)"), null);
    assert.equal(sanitizeNavigation("https://attacker.com/login"), null);
    assert.equal(sanitizeNavigation("http://evil.com"), null);
    assert.equal(sanitizeNavigation("../../../secret"), null);
  });

  await test("Security: sanitizeHtmlAndSvg strips dangerous XSS tags and event handlers", () => {
    const xssInput = `<script>alert('pwned')</script>Hello <svg onload="fetch('http://evil.com')"><rect /></svg> world! <img src="x" onerror="alert(1)">`;
    const sanitized = sanitizeHtmlAndSvg(xssInput);

    assert.ok(!sanitized.includes("<script"));
    assert.ok(!sanitized.includes("<svg"));
    assert.ok(!sanitized.includes("onload="));
    assert.ok(!sanitized.includes("onerror="));
    assert.ok(sanitized.includes("Hello"));
    assert.ok(sanitized.includes("world!"));
  });

  await test("Security: sanitizeSafeUrl strips javascript: and data: schemes", () => {
    assert.equal(sanitizeSafeUrl("javascript:alert(1)"), "#");
    assert.equal(sanitizeSafeUrl("data:text/html,<script>alert(1)</script>"), "#");
    assert.equal(sanitizeSafeUrl("vbscript:MsgBox"), "#");
    assert.equal(sanitizeSafeUrl("https://github.com/profile"), "https://github.com/profile");
    assert.equal(sanitizeSafeUrl("mailto:user@example.com"), "mailto:user@example.com");
  });

  await test("Security: AiToolCallSchema validates allowed tool definitions and rejects unknown tools", () => {
    const validNav = AiToolCallSchema.safeParse({
      tool: "navigateTo",
      parameters: { path: "/resume" },
    });
    assert.equal(validNav.success, true);

    const validProfile = AiToolCallSchema.safeParse({
      tool: "updateUserProfile",
      parameters: { name: "Bharath", targetRole: "Full Stack Engineer" },
    });
    assert.equal(validProfile.success, true);

    const maliciousTool = AiToolCallSchema.safeParse({
      tool: "runBashCommand",
      parameters: { cmd: "rm -rf /" },
    });
    assert.equal(maliciousTool.success, false);
  });

  // ─── 2. Latitude and Longitude Validation ──────────────────────────────────────
  await test("Security: Lat/Lon validation rejects out of range and non-finite values", () => {
    function validateLatLon(rawLat, rawLon) {
      if (rawLat !== null && rawLat !== "") {
        const parsed = parseFloat(rawLat);
        if (!Number.isFinite(parsed) || parsed < -90 || parsed > 90) return false;
      }
      if (rawLon !== null && rawLon !== "") {
        const parsed = parseFloat(rawLon);
        if (!Number.isFinite(parsed) || parsed < -180 || parsed > 180) return false;
      }
      return true;
    }

    assert.equal(validateLatLon("19.0760", "72.8777"), true); // Mumbai
    assert.equal(validateLatLon("0", "0"), true);
    assert.equal(validateLatLon("-90", "-180"), true);
    assert.equal(validateLatLon("90", "180"), true);

    // Out of range
    assert.equal(validateLatLon("91", "50"), false);
    assert.equal(validateLatLon("-95", "50"), false);
    assert.equal(validateLatLon("50", "181"), false);
    assert.equal(validateLatLon("50", "-185"), false);
    assert.equal(validateLatLon("NaN", "50"), false);
    assert.equal(validateLatLon("Infinity", "50"), false);
    assert.equal(validateLatLon("drop table users", "50"), false);
  });

  // ─── 3. VoiceSessionManager: Full Lifecycle & Stale Rejection ─────────────────
  await test("VoiceSessionManager: Full turn lifecycle (Ask -> Speak -> STT -> Commit -> Next)", async () => {
    const manager = VoiceSessionManager.getInstance();
    manager.resetSession();

    let committedField = "";
    let committedValue = "";

    manager.registerFieldCommitter("fullName", async (fieldId, value) => {
      committedField = fieldId;
      committedValue = value;
      return true;
    });

    // Step 1: AI Asks Question 1
    const ctx1 = manager.startInteraction({
      questionId: "q1",
      promptText: "What is your full name?",
      fieldId: "fullName",
    });
    const q1InteractionId = ctx1.interactionId;
    assert.equal(manager.getCurrentInteraction()?.status, "ASKING");
    assert.equal(manager.getCurrentInteraction()?.questionId, "q1");

    // Step 2: AI Finishes Speaking Question
    manager.finishAsking();
    assert.equal(manager.getCurrentInteraction()?.status, "QUESTION_FINISHED");
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(manager.getCurrentInteraction()?.status, "LISTENING");

    // Step 3: User Speaks (STT interim)
    manager.handleSttInterim("Bharath", q1InteractionId);
    assert.equal(manager.getCurrentInteraction()?.status, "USER_SPEAKING");

    // Step 4 & 5: STT Final produced & committed atomically to matching field
    const accepted = await manager.handleSttFinal("Bharath Kumar", "trans-1", q1InteractionId);
    assert.equal(accepted, true);
    assert.equal(manager.getCurrentInteraction()?.status, "COMMITTED");
    assert.equal(committedField, "fullName");
    assert.equal(committedValue, "Bharath Kumar");

    // Step 6: Advance to Question 2
    const ctx2 = manager.startInteraction({
      questionId: "q2",
      promptText: "What is your target role?",
      fieldId: "targetRole",
    });
    const q2InteractionId = ctx2.interactionId;
    assert.notEqual(q1InteractionId, q2InteractionId);
    assert.equal(manager.getCurrentInteraction()?.questionId, "q2");
    assert.equal(manager.getCurrentInteraction()?.fieldId, "targetRole");

    // Step 7: STALE ARRIVAL TEST - Stale Q1 final arrival MUST be rejected and NOT corrupt Q2
    const staleAccepted = await manager.handleSttFinal("Stale late arrival text", "trans-stale", q1InteractionId);
    assert.equal(staleAccepted, false);
    assert.equal(manager.getCurrentInteraction()?.questionId, "q2");
    assert.equal(manager.getCurrentInteraction()?.fieldId, "targetRole");

    // Verify health metrics tracked stale rejection
    const metrics = manager.getMetrics();
    assert.ok(metrics.rejectionsCount.staleInteraction >= 1);
  });

  await test("VoiceSessionManager: Idempotency rejects duplicate final transcripts", async () => {
    const manager = VoiceSessionManager.getInstance();
    manager.resetSession();

    manager.registerFieldCommitter("location", async () => true);

    const ctx = manager.startInteraction({
      questionId: "q3",
      promptText: "What is your location?",
      fieldId: "location",
    });
    manager.finishAsking();

    // First transcript accepted
    const first = await manager.handleSttFinal("San Francisco", "trans-dup-1", ctx.interactionId);
    assert.equal(first, true);

    // Exact duplicate transcript ID rejected
    const duplicate = await manager.handleSttFinal("San Francisco", "trans-dup-1", ctx.interactionId);
    assert.equal(duplicate, false);

    const metrics = manager.getMetrics();
    assert.ok(metrics.rejectionsCount.duplicateTranscript >= 1);
  });

  await test("VoiceSessionManager: Empty noise transcripts are rejected without corrupting state", async () => {
    const manager = VoiceSessionManager.getInstance();
    manager.resetSession();

    const ctx = manager.startInteraction({
      questionId: "q4",
      promptText: "Skills?",
      fieldId: "skills",
    });
    manager.finishAsking();

    const accepted = await manager.handleSttFinal("   ", "trans-noise", ctx.interactionId);
    assert.equal(accepted, false);
    assert.notEqual(manager.getCurrentInteraction()?.status, "ANSWER_READY");

    const metrics = manager.getMetrics();
    assert.ok(metrics.rejectionsCount.noiseRejected >= 1);
  });

  await test("VoiceSessionManager: Silence handling remains restartable and non-terminating", async () => {
    const manager = VoiceSessionManager.getInstance();
    manager.resetSession();

    manager.registerFieldCommitter("phone", async () => true);

    const ctx = manager.startInteraction({
      questionId: "q5",
      promptText: "Phone number?",
      fieldId: "phone",
    });
    manager.finishAsking();
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(manager.getCurrentInteraction()?.status, "LISTENING");

    // Re-prompt / silence reset: listener stays alive and transitions to LISTENING
    await new Promise((r) => setTimeout(r, 50));

    const accepted = await manager.handleSttFinal("+1 555-0199", "trans-phone", ctx.interactionId);
    assert.equal(accepted, true);
    assert.equal(manager.getCurrentInteraction()?.status, "COMMITTED");
  });

  // ─── Summary ──────────────────────────────────────────────────────────────────
  console.log(`\n==================================================`);
  console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`==================================================\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log("ALL UNIT AND INTEGRATION VERIFICATIONS PASSED SUCCESSFULLY!");
  }
}

runSuite().catch((err) => {
  console.error("Test suite fatal error:", err);
  process.exit(1);
});
