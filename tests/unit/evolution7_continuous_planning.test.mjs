/**
 * tests/unit/evolution7_continuous_planning.test.mjs
 *
 * Unit tests verifying Evolution 7:
 * - Weekly Career Review (Factual Milestones vs Proposals)
 * - Automated Weekly Planning (Editable Schedules)
 * - Automated Job Monitoring (Deduplication, Trust Gates, No Fake Alerts)
 * - Career Simulator (Scenario Projections & Prerequisite Calculation)
 * - Financial Reality Planner (Runway Calculation from User Inputs)
 */

import test from "node:test";
import assert from "node:assert/strict";

import { compileWeeklyCareerReview } from "../../lib/career/weeklyReview.ts";
import { generateWeeklyPlan } from "../../lib/career/weeklyPlanning.ts";
import { executeJobMonitoringCheck } from "../../lib/jobs/jobMonitor.ts";
import { simulateCareerScenario } from "../../lib/career/careerSimulator.ts";
import { calculateFinancialPlan } from "../../lib/career/financialPlanner.ts";

test("WeeklyCareerReview: aggregates strictly verified 7-day facts and separates proposals", () => {
  const now = new Date();
  const mockEvidence = [
    {
      id: "ev_rec_1",
      userId: "u777",
      skillId: "docker",
      skillName: "Docker",
      source: "PRACTICE_ASSESSMENT",
      status: "CONFIRMED",
      title: "Docker Practice",
      description: "Resolved multi-stage caching",
      confidence: 0.85,
      createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  const mockApps = [
    {
      applicationId: "app_1",
      userId: "u777",
      jobId: "j1",
      jobTitle: "DevOps Engineer",
      company: "Linear",
      sourceProvider: "lever",
      mappedFields: [],
      validation: { isValid: true, missingRequiredFields: [], unnecessaryFieldsPruned: [], warnings: [] },
      status: "SUBMITTED",
      submittedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      providerSubmissionConfirmationId: "lever_app_999",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  ];

  const review = compileWeeklyCareerReview({
    userId: "u777",
    evidenceItems: mockEvidence,
    applications: mockApps,
    interviewAttempts: [],
    activeSkillGaps: ["Kubernetes"],
  });

  assert.equal(review.confirmedFacts.skillsGained.length, 1);
  assert.equal(review.confirmedFacts.skillsGained[0].skill, "Docker");
  assert.equal(review.confirmedFacts.applicationsSubmitted.length, 1);
  assert.equal(review.confirmedFacts.applicationsSubmitted[0].company, "Linear");
  assert.ok(review.proposedNextWeekPriorities.length > 0);
  assert.ok(review.proposedNextWeekPriorities[0].action.includes("Kubernetes"));
});

test("WeeklyPlanning: distributes manageable daily blocks matching user time constraints", () => {
  const plan = generateWeeklyPlan({
    userId: "u777",
    weeklyAvailableHours: 12,
    skillGaps: ["Docker", "PostgreSQL"],
  });

  assert.equal(plan.weeklyAvailableMinutes, 720);
  assert.equal(plan.dailyBlocks.length, 7);
  assert.ok(plan.totalPlannedMinutes > 0);
  assert.equal(plan.isUserModified, false);

  const mon = plan.dailyBlocks.find((b) => b.dayOfWeek === "MONDAY");
  assert.ok(mon && mon.tasks.length > 0);
});

test("JobMonitor: enforces trust gates and generates zero fake alerts", () => {
  const subscription = {
    subscriptionId: "sub_1",
    userId: "u777",
    targetRoleQuery: "Backend",
    locationQuery: "Remote",
    minimumMatchScore: 70,
    isEnabled: true,
    seenJobIds: [],
    createdAt: new Date().toISOString(),
  };

  const candidateEvidence = [
    {
      id: "ev_1",
      userId: "u777",
      skillId: "typescript",
      skillName: "TypeScript",
      source: "GITHUB_REPOSITORY",
      title: "TS API",
      confidence: 0.9,
      status: "CONFIRMED",
      createdAt: new Date().toISOString(),
      description: "TS backend",
    },
  ];

  const postings = [
    // Qualifying legitimate posting
    {
      id: "job_match_1",
      sourceId: "1",
      sourceProvider: "greenhouse",
      title: "Backend Engineer",
      role: "Backend Engineer",
      company: "Retool",
      location: "Remote",
      workMode: "REMOTE",
      requiredSkills: ["TypeScript"],
      preferredSkills: [],
      minimumYearsExperience: 2,
      educationRequirement: "UNKNOWN",
      responsibilities: ["Build apps"],
      accessibilityClaims: [],
      postedAt: new Date().toISOString(),
      extractedAt: new Date().toISOString(),
      rawTextExcerpt: "Backend development in TypeScript",
      freshnessStatus: "FRESH",
    },
    // Suspicious scam posting (must be blocked by trust gate)
    {
      id: "job_scam_2",
      sourceId: "2",
      sourceProvider: "unverified",
      title: "Remote Backend Assistant",
      role: "Remote Backend Assistant",
      company: "Confidential",
      location: "Remote",
      workMode: "REMOTE",
      requiredSkills: ["TypeScript"],
      preferredSkills: [],
      minimumYearsExperience: 0,
      educationRequirement: "UNKNOWN",
      responsibilities: ["Process wire transfer"],
      accessibilityClaims: [],
      postedAt: new Date().toISOString(),
      extractedAt: new Date().toISOString(),
      rawTextExcerpt: "Telegram chat wire transfer",
      freshnessStatus: "FRESH",
    },
  ];

  const result = executeJobMonitoringCheck({
    subscription,
    candidateEvidence,
    availablePostings: postings,
  });

  // Only the authentic job is alerted; scam posting is rejected
  assert.equal(result.qualifyingNotifications.length, 1);
  assert.equal(result.qualifyingNotifications[0].company, "Retool");
  assert.ok(result.updatedSubscription.seenJobIds.includes("job_match_1"));
});

test("CareerSimulator: resolves prerequisite chain and outputs scenario disclaimer", () => {
  const sim = simulateCareerScenario({
    hypothesis: "What if I learn Next.js?",
    targetSkillsToAcquire: ["Next.js"],
    currentVerifiedSkills: ["JavaScript"], // Missing React prerequisite
    weeklyHoursCommitted: 10,
  });

  assert.ok(sim.identifiedSkillGaps.includes("Next.js"));
  assert.ok(sim.prerequisiteChain.includes("React"));
  assert.ok(sim.projectedWeeksToReadiness > 0);
  assert.equal(sim.disclaimer, "SCENARIO_PROJECTION_NOT_A_GUARANTEE");
});

test("FinancialPlanner: computes runway and feasibility strictly from user inputs", () => {
  const plan = calculateFinancialPlan({
    currentAnnualIncome: 60000,
    targetAnnualIncome: 95000,
    monthlyLivingExpenses: 3000,
    currentLiquidSavings: 18000,
    estimatedLearningCosts: 1500,
    projectedTransitionMonths: 4,
  });

  assert.equal(plan.monthlyBurnRate, 3000);
  assert.equal(plan.totalRunwayMonths, 6);
  assert.equal(plan.runwayBufferStatus, "COMFORTABLE"); // 6 months runway > 4 months transition
  assert.equal(plan.projectedAnnualIncomeDifferential, 35000);
  assert.equal(plan.isFinanciallyFeasible, true);
  assert.equal(plan.provenance, "CALCULATED_FROM_USER_INPUTS");
});
