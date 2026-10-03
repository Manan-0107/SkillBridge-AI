/**
 * tests/unit/evolution6_interview_practice.test.mjs
 *
 * Unit tests verifying Evolution 6:
 * - Structured Interview Memory & Longitudinal Trends
 * - Teach-Back Mode & Misconception Evaluation
 * - Adaptive Interview Simulation tailored to Skill Gaps
 * - Zero Sound-Dependent Accessibility Assistant
 * - Real-World Practice with Automated Evidence Generation
 * - Grounded Rejection Analysis (Zero Hallucinated Motives)
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  recordInterviewAttempt,
  getInterviewHistory,
  analyzeInterviewTrends,
} from "../../lib/interview/interviewMemory.ts";
import {
  generateTeachBackPrompt,
  evaluateTeachBack,
} from "../../lib/interview/teachBack.ts";
import { buildInterviewSessionPlan } from "../../lib/interview/simulator.ts";
import {
  initializeAccessibilityAssistant,
  handleAccessibilityHotkey,
} from "../../lib/interview/accessibilityAssistant.ts";
import {
  generatePracticeTask,
  evaluateRealWorldPractice,
} from "../../lib/interview/realWorldPractice.ts";
import { analyzeRejectionNotice } from "../../lib/interview/rejectionAnalysis.ts";

test("InterviewMemory: records attempts and computes longitudinal score trajectories", () => {
  const userId = "u_perf_1";
  recordInterviewAttempt({
    userId,
    interviewType: "TECHNICAL",
    targetRole: "Backend Engineer",
    question: "How do you handle database deadlocks?",
    userAnswer: "Set transaction isolation levels and timeouts.",
    rubricScore: 75,
    evaluatedCriteria: { clarity: 80, depth: 70 },
    feedback: "Solid foundation",
    weakAreasIdentified: ["PostgreSQL locking modes"],
  });

  recordInterviewAttempt({
    userId,
    interviewType: "TECHNICAL",
    targetRole: "Backend Engineer",
    question: "Explain Postgres MVCC.",
    userAnswer: "Tuples are versioned with xmin and xmax.",
    rubricScore: 85,
    evaluatedCriteria: { clarity: 90, depth: 80 },
    feedback: "Great depth",
    weakAreasIdentified: ["PostgreSQL locking modes"],
  });

  const history = getInterviewHistory(userId);
  assert.equal(history.length, 2);

  const trends = analyzeInterviewTrends(userId);
  assert.equal(trends.totalAttempts, 2);
  assert.equal(trends.averageScore, 80);
  assert.ok(trends.recurrentWeakAreas.includes("PostgreSQL locking modes"));
});

test("TeachBack: prompts concept explanations and detects architectural misconceptions", () => {
  const prompt = generateTeachBackPrompt("Docker");
  assert.ok(prompt.conceptToExplain.includes("Docker"));

  // Misconception: claiming Docker runs full hypervisor
  const flawedEval = evaluateTeachBack(
    prompt,
    "Docker uses a hypervisor to create full virtual machines with separate guest OS kernels on every container."
  );
  assert.equal(flawedEval.accuracyAssessment, "MISCONCEPTIONS_DETECTED");
  assert.ok(flawedEval.identifiedMisconceptions.length > 0);

  // Accurate explanation
  const goodEval = evaluateTeachBack(
    prompt,
    "Docker leverages the shared host Linux kernel, using cgroups for resource limits and namespaces for isolated process trees without hypervisor overhead."
  );
  assert.equal(goodEval.accuracyAssessment, "EXCELLENT");
  assert.ok(goodEval.conceptMasteryScore >= 85);
});

test("Simulator: creates targeted session addressing specific candidate skill gaps", () => {
  const plan = buildInterviewSessionPlan({
    userId: "user_sim_1",
    targetRoleTitle: "DevOps Engineer",
    skillGaps: ["Kubernetes", "Terraform"],
    candidateEvidence: [],
  });

  assert.equal(plan.targetRole, "DevOps Engineer");
  assert.ok(plan.questions.length >= 3);
  assert.ok(plan.questions.some((q) => q.targetedSkill === "Kubernetes"));
  assert.ok(plan.questions.some((q) => q.interviewType === "BEHAVIORAL"));
});

test("AccessibilityAssistant: provides visual state transitions and hotkey controls", () => {
  const state = initializeAccessibilityAssistant();
  assert.equal(state.isCaptionsActive, true);
  assert.equal(state.currentStage, "READY");

  // Spacebar pauses session
  const pauseRes = handleAccessibilityHotkey("Space", state);
  assert.equal(pauseRes.nextState.currentStage, "PAUSED");
  assert.equal(pauseRes.commandExecuted, "PAUSE");

  // KeyS cycles playback speed
  const speedRes = handleAccessibilityHotkey("KeyS", state);
  assert.equal(speedRes.nextState.playbackSpeed, 1.25);
  assert.ok(speedRes.nextState.visualStateLabel.includes("1.25x"));

  // KeyC toggles closed captions
  const captionRes = handleAccessibilityHotkey("KeyC", state);
  assert.equal(captionRes.nextState.isCaptionsActive, false);
});

test("RealWorldPractice: evaluates tasks and converts passing deliverables into wallet evidence", () => {
  const task = generatePracticeTask("Docker", "DEBUG_CODE");
  assert.equal(task.targetSkill, "Docker");

  const passingSubmission = `
    FROM node:18-alpine
    WORKDIR /app
    COPY package*.json ./
    RUN npm install
    COPY . .
    USER node
    CMD ["npm", "start"]
  `;

  const evalResult = evaluateRealWorldPractice({
    userId: "u_prac_1",
    task,
    userSubmission: passingSubmission,
  });

  assert.equal(evalResult.isPassed, true);
  assert.ok(evalResult.generatedEvidence);
  assert.equal(evalResult.generatedEvidence?.skillName, "Docker");
  assert.equal(evalResult.generatedEvidence?.provenance, "SOURCE_VERIFIED");
  assert.equal(evalResult.generatedEvidence?.status, "CONFIRMED");
});

test("RejectionAnalysis: identifies empirical factors without fabricating employer internal motives", () => {
  const mockReq = {
    id: "req_rej",
    sourceId: "1",
    sourceProvider: "lever",
    title: "Senior Go Developer",
    role: "Senior Go Developer",
    company: "Datadog",
    location: "Remote",
    workMode: "REMOTE",
    requiredSkills: ["Go", "Kubernetes"],
    preferredSkills: [],
    minimumYearsExperience: 5,
    educationRequirement: "UNKNOWN",
    responsibilities: [],
    accessibilityClaims: [],
    postedAt: new Date().toISOString(),
    extractedAt: new Date().toISOString(),
    rawTextExcerpt: "Go distributed systems",
    freshnessStatus: "FRESH",
  };

  const report = analyzeRejectionNotice({
    company: "Datadog",
    roleTitle: "Senior Go Developer",
    jobRequirement: mockReq,
    candidateEvidence: [], // 0 Go skills in wallet
    candidateYearsExperience: 2, // 2 vs 5 required
  });

  assert.equal(report.company, "Datadog");
  assert.ok(report.identifiedFactors.some((f) => f.category === "SKILL_REQUIREMENT_GAP"));
  assert.ok(report.identifiedFactors.some((f) => f.category === "YEARS_EXPERIENCE_GAP"));
  assert.ok(report.identifiedFactors.some((f) => f.category === "UNKNOWN_INTERNAL_REASONING"));
  assert.ok(report.constructiveSummary.includes("Datadog"));
});
