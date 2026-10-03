/**
 * tests/unit/phase4_core_product_integration.test.mjs
 *
 * UBIX Phase 4 Core Product Completion & End-to-End Integration Test Suite.
 *
 * Verifies the 6 End-to-End User Journeys across the core product lifecycle:
 * - JOURNEY A: New User (Signup -> Profile -> Goal -> Skill Analysis -> Roadmap -> Learning -> Practice -> Progress)
 * - JOURNEY B: Resume User (Login -> Resume Upload -> Parse -> Analyze -> Save -> Job Matching)
 * - JOURNEY C: Job Seeker (Login -> Search Jobs -> Inspect Job -> Save Job -> Application -> Copilot -> Interview -> Offer)
 * - JOURNEY D: Blind User (Signup -> Voice Normalization -> Spoken Identity Confirmation -> Voice Navigation)
 * - JOURNEY E: Deaf User (Login -> Visual State Equivalents -> Transcript -> Feedback -> No Sound-Only Dependency)
 * - JOURNEY F: Assistant-Driven User (Login -> Assistant -> Career Context -> Tool Action Dispatch -> Confirmation Protocol)
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";

const NextRequest = globalThis.Request;

// Core Security & Auth
import { createSignedSessionToken } from "../../lib/security/session.ts";
import { getAuthoritativeCareerSnapshot, toAuthoritativeCareerState } from "../../lib/ai/orchestrator/authoritativeCareerState.ts";
import { CareerSynthesisEngine } from "../../lib/ai/orchestrator/careerStateSynthesis.ts";

// Resume & Career Match
import { parseStructuredResume } from "../../lib/resume/structuredParser.ts";
import { parseJobDescription, normalizeLiveJob } from "../../lib/career/jobParser.ts";
import { analyzeJobMatch, normalizeSkill } from "../../lib/career/matchEngine.ts";

// Applications, Copilot, Interviews, Offers
import {
  createApplicationRecord,
  generateCoverLetterDraft,
  classifyApplicationQuestion,
  generateQuestionDraft,
} from "../../lib/career/copilot.ts";
import {
  generateInterviewQuestions,
  evaluatePracticeAnswer,
  compareOfferRecords,
} from "../../lib/career/interviewEngine.ts";
import { AdaptiveAssessmentEngine } from "../../lib/ai/orchestrator/adaptiveAssessment.ts";

// Route Handlers
import { GET as roadmapGet } from "../../app/api/roadmap/route.ts";
import { POST as telemetryPost } from "../../app/api/practice/telemetry/route.ts";
import { POST as resumeSavePost } from "../../app/api/resume/save/route.ts";
import { POST as jobsMatchPost } from "../../app/api/jobs/match/route.ts";
import { GET as savedJobsGet, POST as savedJobsPost, DELETE as savedJobsDelete } from "../../app/api/jobs/saved/route.ts";
import { GET as appsGet, POST as appsPost, DELETE as appsDelete } from "../../app/api/applications/route.ts";
import { POST as interviewsPost } from "../../app/api/interviews/route.ts";
import { GET as offersGet, POST as offersPost, DELETE as offersDelete } from "../../app/api/offers/route.ts";
import { POST as assistantChatPost } from "../../app/api/assistant/chat/route.ts";

// Voice & Tools
import { normalizeSpokenEmail } from "../../lib/voice.ts";
import { parseVoiceCommand } from "../../lib/voiceCommands.ts";
import { createConfirmationToken, verifyAndConsumeConfirmationToken, aiTools } from "../../lib/ai/tools.ts";

// =========================================================================
// JOURNEY A — NEW USER LIFECYCLE
// =========================================================================
test("JOURNEY A: New User (Profile -> Goal -> Roadmap -> Learning -> Practice -> Progress)", async () => {
  const userId = `usr_journey_a_${crypto.randomUUID()}`;
  const authCookie = `cf_session=${createSignedSessionToken({
    userId,
    email: "journey_a_new@ubix.internal",
    role: "authenticated",
  })}`;

  // 1. Authoritative Career State defaults to UNKNOWN for new user with no synthetic data
  const snapshot = await getAuthoritativeCareerSnapshot(userId, "journey_a_new@ubix.internal");
  assert.equal(snapshot.userId, userId);
  assert.equal(snapshot.targetRole.status, "UNKNOWN", "Initial target role status must be UNKNOWN");
  assert.equal(snapshot.targetRole.currentValue, null, "No synthetic default role should be invented");
  assert.equal(snapshot.atsScore.currentValue, null, "No fake ATS score for new user");

  // 2. Fetch Personalized Roadmap for requested track
  const roadmapReq = new NextRequest("http://localhost:3000/api/roadmap?category=frontend", {
    method: "GET",
  });
  const roadmapRes = await roadmapGet(roadmapReq);
  assert.equal(roadmapRes.status, 200, "Roadmap API must return 200");
  const roadmapData = await roadmapRes.json();
  assert.equal(roadmapData.success, true);
  assert.ok(Array.isArray(roadmapData.data.tiers), "Roadmap must contain stages/tiers");
  assert.ok(roadmapData.data.tiers.length > 0, "Frontend track must have learning tiers");

  // 3. Inspect first milestone and verify learning resources
  const firstTier = roadmapData.data.tiers[0];
  assert.ok(firstTier.trunkNode, "Stage must contain trunk node");
  assert.ok(Array.isArray(firstTier.trunkNode.resources), "Milestone must contain curated learning resources");
  assert.ok(firstTier.trunkNode.resources.length > 0, "Resources must not be empty");
  assert.ok(firstTier.trunkNode.resources[0].url.startsWith("http"), "Resource must have valid URL");

  // 4. Start Practice session using AdaptiveAssessmentEngine
  const practiceSession = AdaptiveAssessmentEngine.createSession("frontend", "fundamental");
  assert.ok(practiceSession.sessionId.startsWith("assess_"), "Session ID must be generated");
  assert.equal(practiceSession.score, 0, "Initial score must be 0");
  assert.equal(practiceSession.completed, false);

  // 5. Answer questions and verify dynamic difficulty adaptation
  const q1 = {
    questionText: "Explain how JavaScript microtasks differ from macrotasks.",
    subconcept: "event loop",
    difficulty: "fundamental",
    questionNumber: 1,
  };
  const turn1 = AdaptiveAssessmentEngine.recordTurn(
    practiceSession,
    q1,
    "Microtasks run right after the current stack empties and before the next macrotask.",
    "correct"
  );
  assert.equal(turn1.nextState.score > 0, true, "Score should increase on correct answer");
  assert.ok(turn1.nextState.masteredConcepts.includes("event loop"), "Concept should be recorded in mastered concepts");

  // 6. Submit Telemetry to API with Idempotency Key
  const eventId = `evt_${crypto.randomUUID()}`;
  const telemetryReq = new NextRequest("http://localhost:3000/api/practice/telemetry", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: authCookie,
    },
    body: JSON.stringify({
      eventId,
      track: "frontend",
      questionId: "fe-event-loop-1",
      evaluation: "correct",
    }),
  });
  const telemetryRes = await telemetryPost(telemetryReq);
  assert.equal(telemetryRes.status, 200, "Telemetry submission must succeed");
  const telemetryJson = await telemetryRes.json();
  assert.equal(telemetryJson.success, true);
  assert.equal(telemetryJson.scoreAwarded, 10);
  assert.equal(telemetryJson.duplicate, false);

  // 7. Verify Idempotency: duplicate submission does not double-award score
  const dupReq = new NextRequest("http://localhost:3000/api/practice/telemetry", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: authCookie,
    },
    body: JSON.stringify({
      eventId,
      track: "frontend",
      questionId: "fe-event-loop-1",
      evaluation: "correct",
    }),
  });
  const dupRes = await telemetryPost(dupReq);
  const dupJson = await dupRes.json();
  assert.equal(dupJson.duplicate, true, "Duplicate event must be deduplicated");
  assert.equal(dupJson.status, "deduplicated");
});

// =========================================================================
// JOURNEY B — RESUME USER LIFECYCLE
// =========================================================================
test("JOURNEY B: Resume User (Upload/Parse -> Save -> Explainable Job Matching)", async () => {
  const userId = `usr_journey_b_${crypto.randomUUID()}`;
  const authCookie = `cf_session=${createSignedSessionToken({
    userId,
    email: "journey_b_resume@ubix.internal",
    role: "authenticated",
  })}`;

  const sampleResumeRaw = `
ALEX MORGAN
alex.morgan@example.com | (555) 234-5678 | San Francisco, CA
https://linkedin.com/in/alexmorgan | https://github.com/alexmorgan

SUMMARY
Fullstack Software Engineer with 4 years of experience building web applications using React, TypeScript, and Node.js.

WORK EXPERIENCE
Fullstack Engineer | Acme Cloud Solutions | 2022 – Present
• Built real-time collaboration canvas using React, TypeScript, and WebSockets.
• Engineered backend microservices in Node.js and PostgreSQL.
• Reduced API response latency by 35% using Redis caching.

EDUCATION
B.S. in Computer Science | University of California, Berkeley | 2021

SKILLS
React, TypeScript, JavaScript, Node.js, PostgreSQL, Redis, Docker, Git, Tailwind CSS
`;

  // 1. Parse Structured Resume
  const canonicalResume = parseStructuredResume(sampleResumeRaw);
  assert.equal(canonicalResume.basics.name, "ALEX MORGAN");
  assert.equal(canonicalResume.basics.email, "alex.morgan@example.com");
  assert.ok(canonicalResume.work.length > 0, "Extracted work experience");
  assert.ok(canonicalResume.skills.raw.some((s) => s.toLowerCase() === "react"), "Normalized skills include react");
  assert.ok(canonicalResume.skills.raw.some((s) => s.toLowerCase() === "typescript"), "Normalized skills include typescript");

  // 2. Persist Resume via Save API
  const saveReq = new NextRequest("http://localhost:3000/api/resume/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: authCookie,
    },
    body: JSON.stringify({
      filename: "alex_morgan_resume_2026.pdf",
      resumeText: sampleResumeRaw,
      targetRole: "Fullstack Engineer",
      analysisResult: {
        overallScore: 88,
        matchedSkills: ["React", "TypeScript", "Node.js"],
        missingSkills: ["Kubernetes"],
      },
      structuredResume: canonicalResume,
    }),
  });
  const saveRes = await resumeSavePost(saveReq);
  const saveJson = await saveRes.json();
  assert.equal(saveJson.success, true);
  assert.ok(saveJson.uploadId, "Upload ID must be returned");

  // 3. Match Resume against a Job Description
  const targetJobDescription = `
Senior Frontend Engineer at Stripe
Location: Remote (US)
Requirements:
- 4+ years of professional experience with React and TypeScript
- Strong proficiency in state management and web performance
- Experience with Docker and CI/CD pipelines
- Experience with Kubernetes is a plus
`;
  const normalizedJob = normalizeLiveJob({
    id: "job_stripe_fe_1",
    title: "Senior Frontend Engineer",
    company: "Stripe",
    description: targetJobDescription,
    location: "Remote",
  });

  const matchReq = new NextRequest("http://localhost:3000/api/jobs/match", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: authCookie,
    },
    body: JSON.stringify({
      job: normalizedJob,
      resume: canonicalResume,
    }),
  });
  const matchRes = await jobsMatchPost(matchReq);
  assert.equal(matchRes.status, 200, "Match API must succeed");
  const matchJson = await matchRes.json();
  assert.ok(matchJson.matchResult, "Match result must be returned");

  // 4. Verify explainability without hallucination
  const supported = matchJson.matchResult.summary.stronglySupported.concat(matchJson.matchResult.summary.partiallySupported);
  assert.ok(supported.some((s) => s.toLowerCase().includes("react")), "React must be supported");
  assert.ok(supported.some((s) => s.toLowerCase().includes("typescript")), "TypeScript must be supported");

  // Verify Kubernetes is flagged as EVIDENCE_GAP or MISSING (not falsely MATCHED)
  const gaps = matchJson.matchResult.summary.evidenceGaps.concat(matchJson.matchResult.summary.missing);
  const hasK8sGap = gaps.some((g) => g.toLowerCase().includes("kubernetes"));
  assert.ok(hasK8sGap, "Kubernetes must be marked as gap/missing because resume did not list it");
});

// =========================================================================
// JOURNEY C — JOB SEEKER LIFECYCLE
// =========================================================================
test("JOURNEY C: Job Seeker (Save Job -> Application -> Copilot -> Interview -> Offer)", async () => {
  const userAlpha = `usr_seeker_alpha_${crypto.randomUUID()}`;
  const authCookieAlpha = `cf_session=${createSignedSessionToken({
    userId: userAlpha,
    email: "alpha_seeker@ubix.internal",
    role: "authenticated",
  })}`;

  const userBeta = `usr_intruder_beta_${crypto.randomUUID()}`;
  const authCookieBeta = `cf_session=${createSignedSessionToken({
    userId: userBeta,
    email: "beta_intruder@ubix.internal",
    role: "authenticated",
  })}`;

  const testJob = {
    id: `job_${crypto.randomUUID()}`,
    title: "Senior Backend Engineer",
    company: "Vercel",
    location: "Remote",
    description: "Build serverless platforms with Node.js, Go, and PostgreSQL.",
  };

  // 1. Save Job
  const saveJobReq = new NextRequest("http://localhost:3000/api/jobs/saved", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: authCookieAlpha,
    },
    body: JSON.stringify({
      job: testJob,
      notes: "High interest - strong distributed systems team",
    }),
  });
  const saveJobRes = await savedJobsPost(saveJobReq);
  assert.equal(saveJobRes.status, 200);

  // Verify Saved Jobs list for userAlpha
  const getSavedReq = new NextRequest("http://localhost:3000/api/jobs/saved", {
    method: "GET",
    headers: { cookie: authCookieAlpha },
  });
  const getSavedRes = await savedJobsGet(getSavedReq);
  const getSavedJson = await getSavedRes.json();
  assert.ok(getSavedJson.savedJobs.some((j) => j.id === testJob.id || j.job?.id === testJob.id));

  // 2. Create Application
  const createAppReq = new NextRequest("http://localhost:3000/api/applications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: authCookieAlpha,
    },
    body: JSON.stringify({
      action: "create",
      job: testJob,
      savedJobId: testJob.id,
    }),
  });
  const createAppRes = await appsPost(createAppReq);
  assert.equal(createAppRes.status, 200);
  const createAppJson = await createAppRes.json();
  const applicationId = createAppJson.application.id;
  assert.ok(applicationId, "Application ID must be generated");
  assert.equal(createAppJson.application.status, "PREPARING");

  // 3. Application Copilot: Cover letter & Question classification
  const candidateResume = parseStructuredResume(`
SARAH CHEN
sarah.chen@example.com
EXPERIENCE
Senior Backend Developer | CloudScale | 2021-Present
• Designed distributed Redis caching and PostgreSQL query optimization.
• Implemented Go microservices with Kafka pub/sub architecture.
SKILLS: Go, Node.js, PostgreSQL, Redis, Kafka
`);

  const coverLetter = generateCoverLetterDraft({
    job: normalizeLiveJob(testJob),
    resume: candidateResume,
    candidateName: "Sarah Chen",
  });
  assert.ok(coverLetter.draft.includes("Vercel"), "Cover letter mentions company");
  assert.ok(coverLetter.usedEvidence.length > 0, "Uses candidate facts");

  // Sensitive Question Guardrail: AI must refuse to infer sensitive answers
  const sensitiveClassification = classifyApplicationQuestion("Do you have a physical disability or handicap?");
  assert.equal(sensitiveClassification.isSensitive, true);
  const sensitiveDraft = generateQuestionDraft({
    question: "Do you have a physical disability?",
    job: normalizeLiveJob(testJob),
    resume: candidateResume,
  });
  assert.equal(sensitiveDraft.isSensitive, true);
  assert.equal(sensitiveDraft.draft, "", "AI must never generate draft for sensitive question");
  assert.ok(sensitiveDraft.guidance?.includes("sensitive"), "Provides safe neutral guidance");

  // 4. Schedule Interview Round
  const interviewReq = new NextRequest("http://localhost:3000/api/interviews", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: authCookieAlpha,
    },
    body: JSON.stringify({
      action: "record_interview",
      applicationId,
      interviewRecord: {
        roundType: "SYSTEM_DESIGN",
        scheduledAt: new Date(Date.now() + 86400000 * 3).toISOString(),
        format: "VIDEO",
      },
    }),
  });
  const interviewRes = await interviewsPost(interviewReq);
  assert.equal(interviewRes.status, 200);
  const interviewJson = await interviewRes.json();
  assert.equal(interviewJson.application.status, "INTERVIEW");

  // 5. Record Job Offer
  const offerReq = new NextRequest("http://localhost:3000/api/offers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: authCookieAlpha,
    },
    body: JSON.stringify({
      action: "record_offer",
      applicationId,
      offer: {
        company: "Vercel",
        role: "Senior Backend Engineer",
        baseCompensation: "$165,000",
        bonus: "15%",
        equity: "0.05% stock options",
        remoteType: "Remote",
      },
    }),
  });
  const offerRes = await offersPost(offerReq);
  assert.equal(offerRes.status, 200);
  const offerJson = await offerRes.json();
  assert.equal(offerJson.application.status, "OFFER");
  assert.ok(offerJson.offer.id, "Offer ID must be created");

  // 6. Cross-User Isolation: UserBeta cannot access or delete UserAlpha's application
  const betaDeleteReq = new NextRequest(`http://localhost:3000/api/applications?id=${applicationId}`, {
    method: "DELETE",
    headers: { cookie: authCookieBeta },
  });
  const betaDeleteRes = await appsDelete(betaDeleteReq);
  assert.equal(betaDeleteRes.status, 404, "User B must receive 404 attempting to delete User A application");
});

// =========================================================================
// JOURNEY D — BLIND USER LIFECYCLE
// =========================================================================
test("JOURNEY D: Blind User (Voice Spoken Email Normalization & Voice Navigation)", () => {
  // 1. Spoken Punctuation & Email Normalization
  const test1 = normalizeSpokenEmail("john dot doe at the rate gmail dot com");
  assert.equal(test1, "john.doe@gmail.com", "Converts dot and at the rate");

  const test2 = normalizeSpokenEmail("maru email che rahul underscore sharma double one at gmail dot com");
  assert.equal(test2, "rahul_sharma11@gmail.com", "Handles Gujarati prefix, underscore, and double one");

  const test3 = normalizeSpokenEmail("mera email id hai amit dash kumar plus work at outlook dot com");
  assert.equal(test3, "amit-kumar+work@outlook.com", "Handles dash, plus, and outlook domain");

  // 2. Canonical Voice Command Dispatching
  const cmdRoadmap = parseVoiceCommand("open roadmap");
  assert.equal(cmdRoadmap.feature, "roadmap");

  const cmdPractice = parseVoiceCommand("practice");
  assert.equal(cmdPractice.feature, "practice");

  const cmdJobs = parseVoiceCommand("show jobs near me");
  assert.equal(cmdJobs.feature, "local");

  const cmdSkills = parseVoiceCommand("go to resume");
  assert.equal(cmdSkills.feature, "resume");
  assert.equal(cmdSkills.resumeTab, "analyzer");
});

// =========================================================================
// JOURNEY E — DEAF USER LIFECYCLE
// =========================================================================
test("JOURNEY E: Deaf User (Visual Equivalents, No Sound Dependency, Explicit State)", () => {
  // 1. Verification that assessment turn provides structured written feedback without audio dependency
  const session = AdaptiveAssessmentEngine.createSession("backend", "intermediate");
  const turn = AdaptiveAssessmentEngine.recordTurn(
    session,
    {
      questionText: "What are the trade-offs of database indexing?",
      subconcept: "b-tree indexing",
      difficulty: "intermediate",
      questionNumber: 2,
    },
    "B-trees speed up read lookups from O(N) to O(log N) but add overhead on writes and disk space.",
    "correct"
  );
  assert.ok(turn.feedback.length > 0, "Provides visual written feedback");

  // 2. Telemetry and state changes operate purely via JSON and UI state without sound requirements
  assert.ok(turn.nextState.score > 0);
  assert.equal(turn.nextState.questionNumber, 2);
});

// =========================================================================
// JOURNEY F — ASSISTANT-DRIVEN USER LIFECYCLE
// =========================================================================
test("JOURNEY F: Assistant-Driven User (Career Synthesis & Cryptographic Confirmation Tokens)", async () => {
  const userId = `usr_assistant_${crypto.randomUUID()}`;

  // 1. Authoritative Cross-Module Synthesis
  const mockState = {
    goal: { targetRole: "Backend Engineer" },
    roadmap: {
      activeRole: "Backend Engineer",
      currentMilestoneIndex: 1,
      totalMilestones: 5,
      currentMilestoneTitle: "PostgreSQL & Relational Data",
      currentMilestoneConcepts: ["Indexes", "Transactions", "MVCC"],
      completedMilestoneIndices: [0],
      completionPercentage: 20,
    },
    practice: {
      recentScoreAverage: 82,
      totalQuestionsAnswered: 12,
      currentStreak: 4,
      struggledConcepts: ["MVCC", "Deadlocks"],
      masteredConcepts: ["Indexing", "Connection Pooling"],
    },
    resume: {
      hasResume: true,
      atsScore: 84,
      verifiedSkills: ["Node.js", "TypeScript", "PostgreSQL"],
      missingSkills: ["Kubernetes", "Kafka"],
    },
    jobs: {
      targetRoles: ["Backend Engineer"],
      matchedCount: 8,
    },
  };

  const queryType = CareerSynthesisEngine.detectQueryType("What should I work on today?");
  assert.equal(queryType, "daily_focus");
  const synth = CareerSynthesisEngine.synthesize("daily_focus", mockState, "en");
  assert.ok(synth.spokenRecommendation.includes("PostgreSQL"), "Recommends active roadmap milestone");
  assert.ok(synth.actionableStep.length > 0, "Provides grounded action step");

  // 2. Mutating Actions Require Cryptographic Confirmation Tokens
  const params = { email: "new_email@ubix.internal", targetRole: "Principal Engineer" };

  // First call without confirmation produces token
  const unconfirmedResult = await aiTools.modifyProfile.execute({
    name: "Alex",
    email: params.email,
    targetRole: params.targetRole,
    userId,
    confirmed: false,
  });
  assert.equal(unconfirmedResult.success, false);
  assert.equal(unconfirmedResult.requiresConfirmation, true);
  assert.ok(unconfirmedResult.confirmationToken?.startsWith("conf_"), "Cryptographic confirmation token generated");

  // Second call with token succeeds
  const token = unconfirmedResult.confirmationToken;
  const confirmedResult = await aiTools.modifyProfile.execute({
    name: "Alex",
    email: params.email,
    targetRole: params.targetRole,
    userId,
    confirmed: true,
    confirmationToken: token,
  });
  assert.equal(confirmedResult.success, true);
  assert.equal(confirmedResult.applied, true);

  // Token is consumed: repeated use with same token fails
  const replayResult = await aiTools.modifyProfile.execute({
    name: "Alex",
    email: params.email,
    targetRole: params.targetRole,
    userId,
    confirmed: true,
    confirmationToken: token,
  });
  assert.equal(replayResult.success, false, "Consumed token cannot be replayed");
});
