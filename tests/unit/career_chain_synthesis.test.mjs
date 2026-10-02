import { test } from "node:test";
import assert from "node:assert/strict";
import { CareerSynthesisEngine } from "../../lib/ai/orchestrator/careerStateSynthesis.ts";

const mockState = {
  goal: {
    targetRole: "Frontend Developer",
    experienceLevel: "Beginner",
    learningHoursPerWeek: 14,
    location: "Remote",
    targetDeadlineDays: 12,
  },
  roadmap: {
    activeRole: "Frontend Developer",
    currentMilestoneIndex: 1,
    totalMilestones: 6,
    currentMilestoneTitle: "Data Structures & Recursion",
    currentMilestoneConcepts: ["Recursion", "Trees", "Sorting"],
    completedMilestoneIndices: [0],
    completionPercentage: 25,
  },
  practice: {
    recentScoreAverage: 65,
    totalQuestionsAnswered: 50,
    currentStreak: 4,
    struggledConcepts: ["Recursion base cases"],
    masteredConcepts: ["HTML5", "CSS Grid", "JavaScript ES6"],
    latestPracticeDate: "2026-10-01",
  },
  resume: {
    hasResume: true,
    atsScore: 72,
    verifiedSkills: ["JavaScript", "React", "HTML", "CSS"],
    missingSkills: ["TypeScript", "Next.js SSR"],
  },
  jobs: {
    targetRoles: ["Frontend Developer"],
    matchedCount: 18,
    preferredWorkMode: "Remote",
  },
  deadlines: {
    interviewUpcoming: true,
    daysRemaining: 10,
  },
};

test("Career Chain 1: 'What should I work on today?' synthesizes milestone + practice friction + deadline", () => {
  const query = "What should I work on today?";
  const detected = CareerSynthesisEngine.detectQueryType(query);
  assert.equal(detected, "daily_focus");

  const synth = CareerSynthesisEngine.synthesize(detected, mockState, "en");
  assert.equal(synth.primaryFocus, "Recursion base cases");
  assert(synth.spokenRecommendation.includes("Recursion base cases"), "Must mention struggling concept");
  assert(synth.spokenRecommendation.includes("Data Structures & Recursion"), "Must mention active milestone");
  assert(synth.spokenRecommendation.includes("drill"), "Must offer actionable drill");
  assert.equal(synth.targetWorkspace, "practice");
  assert.equal(synth.toolCall?.tool, "startPractice");
});

test("Career Chain 2: 'Why am I learning this?' connects active milestone to target role competencies", () => {
  const query = "Why am I learning this?";
  const detected = CareerSynthesisEngine.detectQueryType(query);
  assert.equal(detected, "why_learning");

  const synth = CareerSynthesisEngine.synthesize(detected, mockState, "en");
  assert(synth.spokenRecommendation.includes("Data Structures & Recursion"), "Must reference current milestone");
  assert(synth.spokenRecommendation.includes("Frontend Developer"), "Must connect to target role");
  assert.equal(synth.targetWorkspace, "courses");
});

test("Career Chain 3: 'What am I weak at?' derives weak areas from practice telemetry and ATS gaps", () => {
  const query = "What am I weak at?";
  const detected = CareerSynthesisEngine.detectQueryType(query);
  assert.equal(detected, "weakness_analysis");

  const synth = CareerSynthesisEngine.synthesize(detected, mockState, "en");
  assert(synth.spokenRecommendation.includes("65%"), "Must report practice score average");
  assert(synth.spokenRecommendation.includes("Recursion base cases"), "Must cite practice struggle");
  assert(synth.spokenRecommendation.includes("TypeScript"), "Must cite resume missing skills");
});

test("Career Chain 4: 'What should I practice next?' prioritizes active milestone struggle topic", () => {
  const query = "What should I practice next?";
  const detected = CareerSynthesisEngine.detectQueryType(query);
  assert.equal(detected, "next_practice");

  const synth = CareerSynthesisEngine.synthesize(detected, mockState, "en");
  assert.equal(synth.primaryFocus, "Recursion base cases");
  assert.equal(synth.targetWorkspace, "practice");
  assert.equal(synth.toolCall?.tool, "startPractice");
});

test("Career Chain 5: 'Have I completed everything for my current milestone?' accurately evaluates completion", () => {
  const query = "Have I completed everything for my current milestone?";
  const detected = CareerSynthesisEngine.detectQueryType(query);
  assert.equal(detected, "milestone_completion");

  const synth = CareerSynthesisEngine.synthesize(detected, mockState, "en");
  assert(synth.spokenRecommendation.includes("not quite done"), "Must identify milestone as incomplete");
  assert(synth.spokenRecommendation.includes("25%"), "Must state overall progress");
  assert.equal(synth.targetWorkspace, "roadmap");
});

test("Career Chain 6: 'Update my roadmap based on my recent practice.' adjusts milestone sequencing", () => {
  const query = "Update my roadmap based on my recent practice.";
  const detected = CareerSynthesisEngine.detectQueryType(query);
  assert.equal(detected, "update_roadmap_from_practice");

  const synth = CareerSynthesisEngine.synthesize(detected, mockState, "en");
  assert(synth.spokenRecommendation.includes("Recursion base cases"), "Must adjust for active struggle");
  assert.equal(synth.targetWorkspace, "roadmap");
});

test("Career Chain 7: 'Find jobs matching what I've learned.' matches verified mastered competencies", () => {
  const query = "Find jobs matching what I've learned.";
  const detected = CareerSynthesisEngine.detectQueryType(query);
  assert.equal(detected, "jobs_matching_learned");

  const synth = CareerSynthesisEngine.synthesize(detected, mockState, "en");
  assert(synth.spokenRecommendation.includes("Frontend Developer"), "Must query target role");
  assert(synth.spokenRecommendation.includes("HTML5"), "Must include mastered concepts");
  assert.equal(synth.targetWorkspace, "jobs");
  assert.equal(synth.toolCall?.tool, "searchJobs");
});

test("Career Chain 8: 'Does my resume reflect my current skills?' identifies unlisted mastered skills", () => {
  const query = "Does my resume reflect my current skills?";
  const detected = CareerSynthesisEngine.detectQueryType(query);
  assert.equal(detected, "resume_reflection");

  const synth = CareerSynthesisEngine.synthesize(detected, mockState, "en");
  assert(synth.spokenRecommendation.includes("lagging behind"), "Identifies unlisted skills on resume");
  assert(synth.spokenRecommendation.includes("HTML5") || synth.spokenRecommendation.includes("CSS Grid"), "Cites unlisted mastered skill");
  assert.equal(synth.targetWorkspace, "resume");
});

test("Career Chain 9: 'What do I need to improve before applying?' provides concrete pre-application gates", () => {
  const query = "What do I need to improve before applying?";
  const detected = CareerSynthesisEngine.detectQueryType(query);
  assert.equal(detected, "pre_application_improvements");

  const synth = CareerSynthesisEngine.synthesize(detected, mockState, "en");
  assert(synth.spokenRecommendation.includes("Recursion base cases"), "Identifies practice improvement");
  assert(synth.spokenRecommendation.includes("TypeScript"), "Identifies missing portfolio skill");
  assert(synth.spokenRecommendation.includes("72%"), "Mentions current ATS score");
});
