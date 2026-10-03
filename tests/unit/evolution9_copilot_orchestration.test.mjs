/**
 * tests/unit/evolution9_copilot_orchestration.test.mjs
 *
 * Unit tests verifying Evolution 9:
 * - Master Career Copilot Multi-Step Orchestration
 * - Strict 3-Tier Action Policy (Safe Automatic vs Confirmation Required)
 * - Safe Multi-Step Lifecycle Planning (Goal → Skills → Project → Resume → Interview → Daily Action)
 * - Scenario 1: "I want to become a backend developer"
 * - Scenario 2: Project evidence triggers review-first resume updates
 * - Scenario 10: "What are you doing?" radical transparency
 */

import test from "node:test";
import assert from "node:assert/strict";

import { orchestrateCareerCopilot } from "../../lib/ai/orchestrator/careerCopilotOrchestrator.ts";
import { verifyAndConsumeConfirmationToken } from "../../lib/ai/tools.ts";

test("Copilot: orchestrates complete multi-step lifecycle for 'I want to become a backend developer'", () => {
  const result = orchestrateCareerCopilot({
    userId: "u_copilot_1",
    prompt: "I want to become a backend developer",
    candidateEvidence: [
      {
        id: "ev_node",
        userId: "u_copilot_1",
        skillId: "nodejs",
        skillName: "Node.js",
        source: "GITHUB_REPOSITORY",
        status: "CONFIRMED",
        title: "Node Express API",
        description: "Built REST API in Node.js",
        confidence: 0.85,
        createdAt: new Date().toISOString(),
      },
    ],
  });

  assert.equal(result.targetRole, "Backend Developer");
  assert.ok(result.identifiedGaps.length > 0);
  assert.ok(result.identifiedGaps.includes("Docker") || result.identifiedGaps.includes("PostgreSQL"));

  // Check planned steps
  assert.ok(result.plannedSteps.length >= 5);
  assert.ok(result.plannedSteps.some((s) => s.phase === "GOAL" && s.actionClass === "SAFE_AUTOMATIC"));
  assert.ok(result.plannedSteps.some((s) => s.phase === "SKILLS" && s.actionClass === "SAFE_AUTOMATIC"));
  assert.ok(result.plannedSteps.some((s) => s.phase === "PROJECT" && s.actionClass === "SAFE_AUTOMATIC"));
  assert.ok(result.plannedSteps.some((s) => s.phase === "RESUME" && s.actionClass === "CONFIRMATION_REQUIRED"));
  assert.ok(result.plannedSteps.some((s) => s.phase === "INTERVIEW" && s.actionClass === "SAFE_AUTOMATIC"));
  assert.ok(result.plannedSteps.some((s) => s.phase === "DAILY_ACTION" && s.actionClass === "SAFE_AUTOMATIC"));

  // Verify Project was generated targeting top gap
  assert.ok(result.suggestedProject);
  assert.ok(result.suggestedProject.milestones.length >= 2);

  // Verify Daily Action plan is generated
  assert.ok(result.dailyPlan);
  assert.ok(result.dailyPlan.items.length > 0);
});

test("Copilot: enforces CONFIRMATION_REQUIRED token contract on resume updates", () => {
  const result = orchestrateCareerCopilot({
    userId: "u_copilot_2",
    prompt: "Update my career materials with my recent Docker work",
    candidateEvidence: [
      {
        id: "ev_docker",
        userId: "u_copilot_2",
        skillId: "docker",
        skillName: "Docker",
        source: "PROJECT_COMPLETED",
        status: "CONFIRMED",
        title: "Dockerized App",
        description: "Built Docker compose stack",
        confidence: 0.9,
        createdAt: new Date().toISOString(),
      },
    ],
  });

  const resumeStep = result.plannedSteps.find((s) => s.phase === "RESUME");
  assert.ok(resumeStep);
  assert.equal(resumeStep.actionClass, "CONFIRMATION_REQUIRED");
  assert.equal(resumeStep.status, "WAITING_FOR_CONFIRMATION");
  assert.ok(resumeStep.confirmationToken?.startsWith("conf_"));

  // Validating consumption of confirmation token
  const token = resumeStep.confirmationToken;
  const isValid = verifyAndConsumeConfirmationToken(token, "update_resume_bullets", "u_copilot_2");
  assert.equal(isValid, true);

  // Single-use token: second consumption fails
  const reuseAttempt = verifyAndConsumeConfirmationToken(token, "update_resume_bullets", "u_copilot_2");
  assert.equal(reuseAttempt, false);
});

test("Copilot: transparently answers 'What are you doing?' (Scenario 10)", () => {
  const result = orchestrateCareerCopilot({
    userId: "u_copilot_3",
    prompt: "I want to transition into frontend development",
    candidateEvidence: [],
  });

  const explanation = result.whatAmIDoingExplanation;
  assert.ok(explanation.currentAction.includes("transition"));
  assert.ok(explanation.reasonWhy.includes("without making unverified assumptions"));
  assert.ok(explanation.dataInputsUsed.length >= 2);
  assert.ok(explanation.nextMilestone.length > 0);
});
