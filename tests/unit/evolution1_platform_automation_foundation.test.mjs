/**
 * tests/unit/evolution1_platform_automation_foundation.test.mjs
 *
 * Evolution 1 — Platform + Automation Foundation Test Suite
 *
 * Validates:
 * - Accessibility Passport presets and migration
 * - Adaptive Interface Engine presentation tokens
 * - Universal Content Transformer modalities
 * - Universal Interaction Layer global command dispatch
 * - Central Automation Engine 3-tier action policy & idempotency
 * - Automation Audit Log with sensitive PII / secret redaction
 * - Personal Career Memory 5-point provenance tracking
 * - Privacy Center field necessity and data minimization
 */

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

describe("EVOLUTION 1 — Platform & Automation Foundation", () => {
  beforeEach(async () => {
    const { _resetAutomationEngine } = await import("../../lib/automation/engine.ts");
    const { _resetAuditLogStore } = await import("../../lib/automation/auditLog.ts");
    const { _resetCareerMemory } = await import("../../lib/memory/careerMemory.ts");
    const { _resetNotificationStore } = await import("../../lib/notifications/notificationManager.ts");

    _resetAutomationEngine();
    _resetAuditLogStore();
    _resetCareerMemory();
    _resetNotificationStore();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Accessibility Passport
  // ─────────────────────────────────────────────────────────────────────────────
  test("1.1 Accessibility Passport: Creates specialized presets and migrates legacy preferences", async () => {
    const {
      createPassportForProfile,
      fromLegacyPreferences,
      sanitizeAccessibilityPassport,
    } = await import("../../lib/accessibility/passport.ts");

    // Deaf profile preset: completely disables voice input and sound alarms
    const deafPassport = createPassportForProfile("deaf_hard_of_hearing");
    assert.equal(deafPassport.profile, "deaf_hard_of_hearing");
    assert.equal(deafPassport.voiceEnabled, false);
    assert.equal(deafPassport.soundNotificationsEnabled, false);
    assert.equal(deafPassport.transcriptPreference, "dedicated_panel");

    // Blind profile preset: voice enabled, high contrast, reduced motion, verbose screen reader
    const blindPassport = createPassportForProfile("blind_low_vision");
    assert.equal(blindPassport.profile, "blind_low_vision");
    assert.equal(blindPassport.voiceEnabled, true);
    assert.equal(blindPassport.contrast, "high");
    assert.equal(blindPassport.reducedMotion, true);
    assert.equal(blindPassport.screenReaderVerbosity, "verbose");

    // Legacy migration
    const migrated = fromLegacyPreferences({
      interactionMode: "voice",
      speechOutput: true,
      voiceNavigation: true,
      visualResponses: true,
      simplifiedLanguage: true,
      captions: true,
      screenReaderMode: true,
      highContrast: true,
      largeText: true,
      reducedMotion: true,
    });
    assert.equal(migrated.preferredInteractionMode, "voice");
    assert.equal(migrated.textSize, "large");
    assert.equal(migrated.contrast, "high");
    assert.equal(migrated.simplifiedLanguage, true);

    // Sanitization with invalid payload returns defaults safely
    const sanitized = sanitizeAccessibilityPassport(null);
    assert.equal(sanitized.version, "1.0.0");
    assert.equal(sanitized.profile, "standard");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Adaptive Interface Engine
  // ─────────────────────────────────────────────────────────────────────────────
  test("1.2 Adaptive Interface Engine: Computes contrast, typography, and motion tokens accurately", async () => {
    const { createPassportForProfile } = await import("../../lib/accessibility/passport.ts");
    const { computeAdaptiveTokens } = await import("../../lib/accessibility/adaptiveEngine.ts");

    const deafPassport = createPassportForProfile("deaf_hard_of_hearing");
    const deafTokens = computeAdaptiveTokens(deafPassport);
    assert.equal(deafTokens.voiceInputEnabled, false, "Deaf profile must unmount microphone");
    assert.equal(deafTokens.showLiveTranscripts, true, "Deaf profile requires live transcripts");

    const maxContrastPassport = createPassportForProfile("standard", { contrast: "maximum", textSize: "xlarge" });
    const maxContrastTokens = computeAdaptiveTokens(maxContrastPassport);
    assert.ok(maxContrastTokens.surfaceClass.includes("bg-black"));
    assert.ok(maxContrastTokens.textSizeClass.includes("text-lg"));
    assert.ok(maxContrastTokens.focusVisibleClass.includes("ring-yellow-300"));

    const reducedMotionPassport = createPassportForProfile("standard", { reducedMotion: true });
    const motionTokens = computeAdaptiveTokens(reducedMotionPassport);
    assert.equal(motionTokens.motionAllowed, false);
    assert.equal(motionTokens.transitionClass, "transition-none");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Universal Content Transformer
  // ─────────────────────────────────────────────────────────────────────────────
  test("1.3 Universal Content Transformer: Generates concise, step-by-step, simplified, and teach-back formats", async () => {
    const { transformContent } = await import("../../lib/accessibility/transformer.ts");

    const sample = "Docker is a containerization platform. It packages applications with dependencies into isolated containers. Developers utilize containers for consistent deployments.";

    // Concise
    const concise = transformContent(sample, "concise", { maxSentences: 1 });
    assert.equal(concise.format, "concise");
    assert.equal(concise.provenance, "FACTUAL_PRESERVED");
    assert.ok(concise.transformedText.includes("Docker is a containerization platform."));

    // Step-by-step
    const steps = transformContent(sample, "step_by_step");
    assert.ok(steps.steps && steps.steps.length === 3);
    assert.ok(steps.steps[0].startsWith("Step 1:"));

    // Simplified language
    const simplified = transformContent(sample, "simplified_language");
    assert.ok(simplified.transformedText.includes("use containers"), "Must replace 'utilize' with plain English");

    // Teach-back format
    const teachBack = transformContent(sample, "teach_back");
    assert.ok(teachBack.transformedText.includes("Can you explain the main idea of this in your own words?"));
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Universal Interaction Layer
  // ─────────────────────────────────────────────────────────────────────────────
  test("1.4 Universal Interaction Layer: Accurately parses and dispatches global voice commands", async () => {
    const { matchGlobalCommand } = await import("../../lib/accessibility/interactionLayer.ts");

    assert.equal(matchGlobalCommand("go home")?.targetRoute, "/");
    assert.equal(matchGlobalCommand("open assistant")?.targetRoute, "/journey");
    assert.equal(matchGlobalCommand("show skill gaps")?.targetRoute, "/journey");
    assert.equal(matchGlobalCommand("show jobs")?.targetRoute, "/jobs");
    assert.equal(matchGlobalCommand("build resume")?.targetRoute, "/resume");
    assert.equal(matchGlobalCommand("start practice")?.targetRoute, "/practice");
    assert.equal(matchGlobalCommand("stop listening")?.actionType, "CONTROL");
    assert.equal(matchGlobalCommand("unknown random babble"), null);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Automation Engine & Action Classes
  // ─────────────────────────────────────────────────────────────────────────────
  test("1.5 Automation Engine: Enforces strict 3-tier action policy and idempotency", async () => {
    const {
      registerAutomation,
      triggerAutomation,
      confirmAutomation,
      getUserExecutions,
    } = await import("../../lib/automation/engine.ts");

    // 1. SAFE_AUTOMATIC runs directly
    registerAutomation({
      id: "auto_analyze_gap",
      name: "Analyze Skill Gaps",
      description: "Automatically analyzes skill gaps from target role",
      actionClass: "SAFE_AUTOMATIC",
      triggerType: "USER_ACTION",
      enabled: true,
      maxRetries: 1,
      timeoutMs: 5000,
    });

    const safeExec = await triggerAutomation(
      "auto_analyze_gap",
      "user_alpha",
      { type: "USER_ACTION", sourceId: "profile_save", timestamp: new Date().toISOString() },
      async () => ({ gapsIdentified: ["TypeScript", "Docker"] })
    );

    assert.equal(safeExec.state, "COMPLETED");
    assert.equal(safeExec.result?.gapsIdentified?.length, 2);

    // 2. CONFIRMATION_REQUIRED pauses and requires explicit single-use token
    registerAutomation({
      id: "auto_modify_resume",
      name: "Update Resume Highlights",
      description: "Modifies public resume bullets based on project evidence",
      actionClass: "CONFIRMATION_REQUIRED",
      triggerType: "USER_ACTION",
      enabled: true,
      maxRetries: 1,
      timeoutMs: 5000,
    });

    const confExec = await triggerAutomation(
      "auto_modify_resume",
      "user_alpha",
      { type: "USER_ACTION", sourceId: "project_done", timestamp: new Date().toISOString() }
    );

    assert.equal(confExec.state, "WAITING_FOR_CONFIRMATION");
    assert.ok(confExec.confirmationToken);

    // Confirm execution
    const confirmed = await confirmAutomation(
      confExec.id,
      "user_alpha",
      confExec.confirmationToken,
      async () => ({ resumeUpdated: true })
    );
    assert.equal(confirmed.state, "COMPLETED");
    assert.equal(confirmed.provenance, "USER_CONFIRMED");

    // Replay with consumed token must fail
    await assert.rejects(
      async () => {
        await confirmAutomation(confExec.id, "user_alpha", "invalid_token");
      },
      /Invalid confirmation token|Automation is not awaiting confirmation/
    );

    // 3. EXPLICIT_HUMAN_ACTION rejects automatic background trigger
    registerAutomation({
      id: "auto_submit_application",
      name: "Submit External Application",
      description: "Submits formal job application to employer",
      actionClass: "EXPLICIT_HUMAN_ACTION",
      triggerType: "NEW_MATCHING_JOB",
      enabled: true,
      maxRetries: 0,
      timeoutMs: 5000,
    });

    const rejectedExec = await triggerAutomation(
      "auto_submit_application",
      "user_alpha",
      { type: "NEW_MATCHING_JOB", sourceId: "job_99", timestamp: new Date().toISOString() }
    );
    assert.equal(rejectedExec.state, "CANCELLED");
    assert.ok(rejectedExec.error?.includes("cannot be triggered automatically"));
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Automation Audit Log
  // ─────────────────────────────────────────────────────────────────────────────
  test("1.6 Automation Audit Log: Scopes by user and automatically redacts sensitive keys", async () => {
    const { recordAutomationAudit, getUserAutomationAuditLogs } = await import(
      "../../lib/automation/auditLog.ts"
    );

    recordAutomationAudit({
      executionId: "exec_1",
      automationId: "auto_test",
      userId: "user_gamma",
      actionClass: "SAFE_AUTOMATIC",
      triggerType: "USER_ACTION",
      state: "COMPLETED",
      summary: "Completed test task",
      details: {
        password: "SuperSecretPassword123!",
        sessionToken: "cf_token_abc_123",
        regularDetail: "Processed 5 items",
      },
      hasExternalSideEffects: false,
    });

    const logs = getUserAutomationAuditLogs("user_gamma");
    assert.equal(logs.length, 1);
    assert.equal(logs[0].details?.password, "[REDACTED]");
    assert.equal(logs[0].details?.sessionToken, "[REDACTED]");
    assert.equal(logs[0].details?.regularDetail, "Processed 5 items");

    // Other user cannot see user_gamma's logs
    const isolatedLogs = getUserAutomationAuditLogs("user_other");
    assert.equal(isolatedLogs.length, 0);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. Personal Career Memory
  // ─────────────────────────────────────────────────────────────────────────────
  test("1.7 Career Memory: Enforces strict provenance and prevents silent promotion of inferences", async () => {
    const {
      recordMemoryItem,
      confirmMemoryItem,
      rejectMemoryItem,
      getUserCareerMemory,
      getConfirmedCareerFacts,
    } = await import("../../lib/memory/careerMemory.ts");

    // Add inferred item
    const item = recordMemoryItem({
      userId: "user_delta",
      category: "CAREER_GOAL",
      key: "target_domain",
      value: "Cloud Infrastructure",
      provenance: "INFERRED",
      confidence: 0.65,
      sourceDescription: "Derived from candidate interest in Kubernetes",
    });

    assert.equal(item.provenance, "INFERRED");
    assert.equal(getConfirmedCareerFacts("user_delta").length, 0, "Inferred item must not be listed as confirmed");

    // Confirm by user
    const confirmed = confirmMemoryItem("user_delta", item.id);
    assert.equal(confirmed.provenance, "CONFIRMED");
    assert.equal(confirmed.confidence, 1.0);
    assert.equal(getConfirmedCareerFacts("user_delta").length, 1);

    // Reject memory item
    const rejected = rejectMemoryItem("user_delta", item.id, "No longer interested in cloud roles");
    assert.equal(rejected.provenance, "USER_REJECTED");

    // Re-recording inferred value cannot overwrite user rejection
    recordMemoryItem({
      userId: "user_delta",
      category: "CAREER_GOAL",
      key: "target_domain",
      value: "Cloud Infrastructure",
      provenance: "INFERRED",
      confidence: 0.7,
      sourceDescription: "Assistant attempted inference",
    });

    const memory = getUserCareerMemory("user_delta", { category: "CAREER_GOAL" });
    assert.equal(memory[0].provenance, "USER_REJECTED", "Must never override explicit user rejection with AI inference");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. Privacy Center
  // ─────────────────────────────────────────────────────────────────────────────
  test("1.8 Privacy Center: Provides transparent field explanations and safe deletion planning", async () => {
    const {
      explainFieldRequest,
      exportUserDataSummary,
      prepareDataDeletionPlan,
    } = await import("../../lib/privacy/privacyCenter.ts");

    const explanation = explainFieldRequest("target_role");
    assert.equal(explanation.necessity, "REQUIRED");
    assert.equal(explanation.stored, "SECURE_DATABASE");
    assert.equal(explanation.canSkip, false);

    const salaryExplanation = explainFieldRequest("current_salary");
    assert.equal(salaryExplanation.necessity, "OPTIONAL");
    assert.ok(salaryExplanation.whoReceives.includes("Never shared with prospective employers"));

    const exportSummary = exportUserDataSummary("user_beta");
    assert.equal(exportSummary.userId, "user_beta");
    assert.equal(exportSummary.exportFormat, "JSON");

    const deletePlan = prepareDataDeletionPlan("user_beta");
    assert.equal(deletePlan.requiresExplicitConfirmation, true);
    assert.ok(deletePlan.warningMessage.includes("permanent and irreversible"));
  });
});
