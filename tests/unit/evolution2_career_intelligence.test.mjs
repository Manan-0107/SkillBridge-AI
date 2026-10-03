/**
 * tests/unit/evolution2_career_intelligence.test.mjs
 *
 * Evolution 2 — Career Intelligence & Evidence System Test Suite
 *
 * Validates:
 * - Canonical Skill Graph (normalization, prerequisites, next-skill recommendations)
 * - Career Evidence Wallet (multi-source, 5 provenance states, confidence aggregation)
 * - Career Goal Discovery (user-stated vs inferred, transition estimation)
 * - Non-Traditional Experience Translator (grounded skill translation without inflation)
 * - Career Gap Explainer (evidence-backed rationale)
 * - Chronological Career Timeline (filtering, provenance)
 * - Daily Action Engine (energy- and time-aware planning)
 * - Career Recovery (non-judgmental restart)
 * - Career Twin (deterministic what-if scenario simulation)
 */

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

describe("EVOLUTION 2 — Career Intelligence & Evidence System", () => {
  beforeEach(async () => {
    const { _resetEvidenceWallet } = await import("../../lib/career/evidenceWallet.ts");
    const { _resetCareerTimeline } = await import("../../lib/career/careerTimeline.ts");

    _resetEvidenceWallet();
    _resetCareerTimeline();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Canonical Skill Graph
  // ─────────────────────────────────────────────────────────────────────────────
  test("2.1 Canonical Skill Graph: Normalizes aliases and resolves prerequisite chains", async () => {
    const {
      normalizeSkillName,
      getSkillDefinition,
      getSkillPrerequisites,
      getRecommendedNextSkills,
    } = await import("../../lib/career/skillGraph.ts");

    assert.equal(normalizeSkillName("React.js"), "react");
    assert.equal(normalizeSkillName("NodeJS"), "node.js");
    assert.equal(normalizeSkillName("TypeScript"), "typescript");

    const reactDef = getSkillDefinition("react");
    assert.ok(reactDef);
    assert.equal(reactDef?.category, "FRONTEND");

    const prereqs = getSkillPrerequisites("react");
    const prereqNames = prereqs.map((p) => p.id);
    assert.ok(prereqNames.includes("javascript"));
    assert.ok(prereqNames.includes("html"));
    assert.ok(prereqNames.includes("css"));

    const nextSkills = getRecommendedNextSkills(["javascript", "react"]);
    assert.ok(nextSkills.length > 0);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Career Evidence Wallet
  // ─────────────────────────────────────────────────────────────────────────────
  test("2.2 Evidence Wallet: Tracks multi-source artifacts and aggregates verified skills", async () => {
    const {
      recordSkillEvidence,
      confirmEvidence,
      rejectEvidence,
      getUserEvidenceWallet,
      getVerifiedSkillsForUser,
    } = await import("../../lib/career/evidenceWallet.ts");

    const ev1 = recordSkillEvidence({
      userId: "cand_1",
      skillName: "TypeScript",
      source: "PROJECT_COMPLETED",
      status: "INFERRED",
      confidence: 0.75,
      title: "Built Next.js Dashboard",
      description: "Implemented fully-typed API handlers and UI components",
    });

    assert.equal(ev1.skillId, "typescript");
    assert.equal(ev1.status, "INFERRED");

    // Before confirmation, not counted in verified skills
    assert.equal(getVerifiedSkillsForUser("cand_1").length, 0);

    // Confirm evidence
    confirmEvidence("cand_1", ev1.id);
    const verified = getVerifiedSkillsForUser("cand_1");
    assert.equal(verified.length, 1);
    assert.equal(verified[0].skillId, "typescript");
    assert.ok(verified[0].confidence >= 0.9);

    // Reject an item
    const ev2 = recordSkillEvidence({
      userId: "cand_1",
      skillName: "Docker",
      source: "RESUME_PARSED",
      status: "INFERRED",
      confidence: 0.5,
      title: "Mentioned on resume",
      description: "Keyword found",
    });
    rejectEvidence("cand_1", ev2.id, "Candidate indicated no Docker experience");

    const wallet = getUserEvidenceWallet("cand_1");
    const dockerItem = wallet.find((w) => w.skillId === "docker");
    assert.equal(dockerItem?.status, "USER_REJECTED");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Career Goal Discovery
  // ─────────────────────────────────────────────────────────────────────────────
  test("2.3 Career Goal Discovery: Accurately classifies USER_STATED vs INFERRED directions", async () => {
    const { discoverCareerGoals } = await import("../../lib/career/goalDiscovery.ts");

    const results = discoverCareerGoals({
      statedGoal: "frontend_developer",
      knownSkills: ["JavaScript", "HTML", "CSS"],
    });

    assert.ok(results.length > 0);
    const topGoal = results[0];
    assert.equal(topGoal.roleId, "frontend_developer");
    assert.equal(topGoal.provenance, "USER_STATED");
    assert.ok(topGoal.matchScore >= 50);
    assert.ok(topGoal.estimatedTransitionWeeks > 0);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Non-Traditional Experience Translator
  // ─────────────────────────────────────────────────────────────────────────────
  test("2.4 Experience Translator: Translates non-traditional roles into grounded evidence without inflation", async () => {
    const { translateExperience } = await import("../../lib/career/experienceTranslator.ts");

    const caregiving = translateExperience({
      domain: "CAREGIVING",
      description: "Managed intensive medical care and provider coordination for elderly relative.",
    });

    assert.equal(caregiving.domain, "CAREGIVING");
    assert.equal(caregiving.provenance, "TRANSLATED_FACTUAL");
    assert.ok(caregiving.extractedSkills.some((s) => s.skillName.includes("Crisis Management")));
    assert.ok(caregiving.resumeBulletSuggestions.length > 0);

    const openSource = translateExperience({
      domain: "OPEN_SOURCE",
      description: "Submitted bug fixes in React and reviewed community pull requests.",
    });
    assert.ok(openSource.extractedSkills.some((s) => s.skillName === "React"));
    assert.ok(openSource.verifiableAchievements.length > 0);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Career Gap Explainer
  // ─────────────────────────────────────────────────────────────────────────────
  test("2.5 Career Gap Explainer: Explains why gaps matter and checks prerequisite fulfillment", async () => {
    const { explainSkillGap } = await import("../../lib/career/gapExplainer.ts");

    const analysis = explainSkillGap("typescript", [], "Frontend Developer");
    assert.equal(analysis.skillId, "typescript");
    assert.equal(analysis.currentEvidenceCount, 0);
    assert.ok(analysis.whyThisGapMatters.includes("TypeScript"));
    assert.ok(analysis.recommendedPractice.length > 0);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Chronological Career Timeline
  // ─────────────────────────────────────────────────────────────────────────────
  test("2.6 Career Timeline: Appends, sorts, and filters milestone events", async () => {
    const { recordTimelineEvent, getUserCareerTimeline } = await import(
      "../../lib/career/careerTimeline.ts"
    );

    recordTimelineEvent({
      userId: "user_tl_1",
      type: "GOAL_SET",
      title: "Targeted Backend Developer",
      description: "User confirmed backend role milestone",
      timestamp: new Date("2026-01-01T10:00:00Z").toISOString(),
    });

    recordTimelineEvent({
      userId: "user_tl_1",
      type: "SKILL_VERIFIED",
      title: "Verified Node.js",
      description: "Passed interactive STAR technical challenge",
      timestamp: new Date("2026-01-15T12:00:00Z").toISOString(),
    });

    const allEvents = getUserCareerTimeline("user_tl_1");
    assert.equal(allEvents.length, 2);

    const filtered = getUserCareerTimeline("user_tl_1", { type: "SKILL_VERIFIED" });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].title, "Verified Node.js");
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. Daily Action Engine
  // ─────────────────────────────────────────────────────────────────────────────
  test("2.7 Daily Action Engine: Adapts session plan to energy level and time budget", async () => {
    const { generateDailyPlan } = await import("../../lib/career/dailyActionEngine.ts");

    // Low energy plan: reading and jobs
    const lowPlan = generateDailyPlan({
      availableMinutes: 30,
      energyLevel: "low",
      topSkillGap: "Docker",
    });
    assert.equal(lowPlan.energyLevel, "low");
    assert.ok(lowPlan.items.some((i) => i.category === "JOBS" || i.category === "LEARNING"));

    // High energy plan: project implementation
    const highPlan = generateDailyPlan({
      availableMinutes: 60,
      energyLevel: "high",
      topSkillGap: "PostgreSQL",
    });
    assert.equal(highPlan.energyLevel, "high");
    assert.ok(highPlan.items.some((i) => i.category === "PROJECT"));
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. Career Recovery & Career Twin
  // ─────────────────────────────────────────────────────────────────────────────
  test("2.8 Career Recovery & Career Twin: Empathetic re-entry and what-if simulation", async () => {
    const { generateRecoveryPlan } = await import("../../lib/career/careerRecovery.ts");
    const { simulateCareerGrowth } = await import("../../lib/career/careerTwin.ts");

    const recovery = generateRecoveryPlan({
      roleTitle: "Full-Stack Engineer",
      verifiedSkills: ["JavaScript", "HTML", "CSS"],
      pendingSkills: ["TypeScript", "Docker"],
      daysInactive: 21,
    });
    assert.equal(recovery.status, "READY_TO_RESUME");
    assert.ok(recovery.welcomeMessage.includes("Welcome back!"));
    assert.ok(!recovery.welcomeMessage.includes("missed") && !recovery.welcomeMessage.includes("lost"));
    assert.equal(recovery.quickWinRestartTask.estimatedMinutes, 15);

    const simulation = simulateCareerGrowth(
      {
        targetSkillToAdd: "docker",
        hoursPerWeek: 10,
        currentRole: "Frontend Developer",
        targetRole: "Full-Stack Developer",
      },
      [
        {
          id: "ev_1",
          userId: "sim_user",
          skillId: "javascript",
          skillName: "JavaScript",
          source: "USER_CONFIRMATION",
          status: "CONFIRMED",
          confidence: 1.0,
          title: "JS Mastery",
          description: "Verified",
          createdAt: new Date().toISOString(),
        },
      ]
    );

    assert.ok(simulation.effortEstimateWeeks > 0);
    assert.ok(simulation.marketAlignmentDeltaPercent > 0);
    assert.ok(simulation.traceableEvidenceInputs.length > 0);
  });
});
