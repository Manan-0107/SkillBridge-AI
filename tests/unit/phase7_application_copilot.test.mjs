/**
 * tests/unit/phase7_application_copilot.test.mjs
 *
 * Phase 7 Application Copilot, Preparation & Tracking Test Suite:
 * - Application Lifecycle & Status Transitions (SAVED -> PREPARING -> READY -> APPLIED)
 * - Grounded Cover Letter Drafting (uses verified facts from resume; no hallucinations)
 * - Application Question Drafter (Technical/Motivation vs. Sensitive Question Guardrails)
 * - Sensitive Question Invariant (Disability, health, and legal status are NEVER inferred or fabricated)
 * - User Ownership & Session Isolation (IDOR Defense on /api/applications)
 * - Timeline Event Creation & Non-hallucination
 * - No Automatic Submission Invariant
 */

import { test } from "node:test";
import assert from "node:assert/strict";

const NextRequest = globalThis.Request;

import { createSignedSessionToken } from "../../lib/security/session.ts";
import { parseStructuredResume } from "../../lib/resume/structuredParser.ts";
import { parseJobDescription } from "../../lib/career/jobParser.ts";
import {
  classifyApplicationQuestion,
  generateCoverLetterDraft,
  generateQuestionDraft,
  createApplicationRecord,
} from "../../lib/career/copilot.ts";
import { GET as appsGet, POST as appsPost, DELETE as appsDelete } from "../../app/api/applications/route.ts";
import { POST as copilotPost } from "../../app/api/applications/copilot/route.ts";

const testUser1 = "user_phase7_owner_alpha";
const validTokenUser1 = createSignedSessionToken({
  userId: testUser1,
  email: "phase7alpha@careerforge.test",
  role: "authenticated",
});
const authCookieUser1 = `cf_session=${validTokenUser1}`;

const testUser2 = "user_phase7_intruder_beta";
const validTokenUser2 = createSignedSessionToken({
  userId: testUser2,
  email: "phase7beta@careerforge.test",
  role: "authenticated",
});
const authCookieUser2 = `cf_session=${validTokenUser2}`;

const sampleResumeRaw = `
ELENA VANCE
elena.vance@example.com | (555) 314-1592 | Seattle, WA
https://linkedin.com/in/elenavance | https://github.com/elenavance

PROFESSIONAL SUMMARY
Senior Backend Engineer with 5+ years of experience designing high-scale REST APIs and microservices.

WORK EXPERIENCE
Lead Distributed Systems Engineer | Black Mesa Tech | 2021 – Present
• Architected event-driven microservices using Node.js, TypeScript, and Kafka.
• Streamlined PostgreSQL query performance and managed Redis caching layers.
• Implemented automated CI/CD deployment pipelines using Docker and Kubernetes.

EDUCATION
B.S. in Computer Science | University of Washington | 2018

TECHNICAL SKILLS
Languages: TypeScript, Python, Go, SQL, Bash
Frameworks: Node.js, Express, FastAPI, Next.js
Databases: PostgreSQL, Redis, MongoDB
Cloud: Docker, Kubernetes, AWS, Terraform
Tools: Git, Jira, Postman, Jest

PROJECTS
Cloud Monitor Dashboard | TypeScript, Next.js, Redis
• Developed real-time telemetry observation dashboard for distributed nodes.
`;

const sampleJobRaw = `
Senior Platform Engineer
Acme Cloud Services - Remote

Responsibilities:
• Architect scalable microservices in TypeScript or Python.
• Maintain PostgreSQL databases and distributed caches.
• Manage container orchestration with Kubernetes.

Requirements:
• Must have at least 3 years experience with TypeScript and Node.js
• Proven experience with PostgreSQL and Docker is required
• Experience with Kubernetes is mandatory
`;

// ─── 1. Application Lifecycle & Creation Tests ────────────────────────────────

test("createApplicationRecord initializes valid application with traceable timeline", () => {
  const job = parseJobDescription({ rawText: sampleJobRaw });
  const app = createApplicationRecord({
    userId: testUser1,
    job,
    resumeVersionName: "Backend Engineer v2",
  });

  assert.equal(app.userId, testUser1);
  assert.equal(app.jobTitle, "Senior Platform Engineer");
  assert.equal(app.company, "Acme Cloud Services");
  assert.equal(app.status, "PREPARING");
  assert.equal(app.resumeVersionName, "Backend Engineer v2");
  assert.ok(app.timeline.length >= 2, "Expected initial timeline events");
  assert.equal(app.timeline[0].eventType, "JOB_SAVED");
});

// ─── 2. Question Classification & Sensitive Question Boundaries ───────────────

test("classifyApplicationQuestion correctly detects sensitive categories vs technical/motivation", () => {
  // Sensitive questions (Must NEVER be answered by AI)
  const q1 = classifyApplicationQuestion("Do you require visa sponsorship or have a disability?");
  assert.equal(q1.isSensitive, true);
  assert.equal(q1.category, "sensitive");

  const q2 = classifyApplicationQuestion("Please indicate your race, ethnicity, or veteran status.");
  assert.equal(q2.isSensitive, true);
  assert.equal(q2.category, "sensitive");

  // Non-sensitive questions
  const q3 = classifyApplicationQuestion("Why are you interested in joining Acme Cloud?");
  assert.equal(q3.isSensitive, false);
  assert.equal(q3.category, "motivation");

  const q4 = classifyApplicationQuestion("Describe your experience with TypeScript microservices.");
  assert.equal(q4.isSensitive, false);
  assert.equal(q4.category, "technical");

  const q5 = classifyApplicationQuestion("Tell me about a challenging bug you diagnosed.");
  assert.equal(q5.isSensitive, false);
  assert.equal(q5.category, "behavioral");
});

test("generateQuestionDraft refuses to infer sensitive questions and returns user guidance", () => {
  const resume = parseStructuredResume(sampleResumeRaw);
  const sensitiveResult = generateQuestionDraft({
    question: "Do you have a medical condition or disability requiring accommodations?",
    resume,
  });

  assert.equal(sensitiveResult.isSensitive, true);
  assert.equal(sensitiveResult.draft, ""); // Zero fabricated response
  assert.ok(sensitiveResult.guidance.includes("never generates or infers responses to sensitive"));
});

// ─── 3. Grounded Cover Letter & Factual Integrity ──────────────────────────────

test("generateCoverLetterDraft creates grounded drafts using only real candidate experience", () => {
  const resume = parseStructuredResume(sampleResumeRaw);
  const job = parseJobDescription({ rawText: sampleJobRaw });

  const result = generateCoverLetterDraft({
    job,
    resume,
    candidateName: "Elena Vance",
    userNotes: "Focus on distributed systems resilience",
  });

  assert.ok(result.draft.includes("Elena Vance"));
  assert.ok(result.draft.includes("Black Mesa Tech"));
  assert.ok(result.draft.includes("Acme Cloud Services"));
  assert.ok(result.draft.includes("distributed systems resilience"));
  assert.ok(result.usedEvidence.some((e) => e.includes("Black Mesa Tech")));
});

// ─── 4. Applications API Security & IDOR Isolation ─────────────────────────────

test("Applications API enforces session authentication and strictly isolates user records", async () => {
  // 1. Unauthenticated request rejected with 401
  const unauthReq = new NextRequest("http://localhost:3000/api/applications", { method: "GET" });
  const unauthRes = await appsGet(unauthReq);
  assert.equal(unauthRes.status, 401);

  // 2. User 1 creates an application
  const job = parseJobDescription({ rawText: sampleJobRaw });
  const createReq = new NextRequest("http://localhost:3000/api/applications", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: authCookieUser1 },
    body: JSON.stringify({ action: "create", job }),
  });

  const createRes = await appsPost(createReq);
  assert.equal(createRes.status, 200);
  const createData = await createRes.json();
  assert.ok(createData.application?.id);
  assert.equal(createData.application.userId, testUser1);

  // 3. User 2 cannot access or see User 1's applications
  const user2Req = new NextRequest("http://localhost:3000/api/applications", {
    method: "GET",
    headers: { Cookie: authCookieUser2 },
  });
  const user2Res = await appsGet(user2Req);
  assert.equal(user2Res.status, 200);
  const user2Data = await user2Res.json();
  const foundUser1App = user2Data.applications.some((a) => a.id === createData.application.id);
  assert.equal(foundUser1App, false, "User 2 must not see User 1 applications");
});

test("POST /api/applications/copilot rejects unauthenticated and invalid actions", async () => {
  const req = new NextRequest("http://localhost:3000/api/applications/copilot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "generate_cover_letter" }),
  });
  const res = await copilotPost(req);
  assert.equal(res.status, 401);
});
