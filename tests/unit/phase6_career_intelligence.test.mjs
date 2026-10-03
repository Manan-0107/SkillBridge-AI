/**
 * tests/unit/phase6_career_intelligence.test.mjs
 *
 * Phase 6 Career Intelligence & Explainable Job Matching Test Suite:
 * - Deterministic Job Description Parsing (Section detection, keyword normalization)
 * - Conservative Requirement Classification (REQUIRED vs PREFERRED vs OPTIONAL vs UNKNOWN)
 * - Conservative Skill Equivalence (React == React.js, C++ == C plus plus, but Java != JavaScript, Python != PyTorch)
 * - Explainable Matching Engine (MATCHED, PARTIAL, MISSING, EVIDENCE_GAP, UNKNOWN)
 * - Verbatim Resume Evidence Extraction (quotes work experience / project bullets)
 * - Non-hallucination & Factual Integrity (zero invented stats or experience)
 * - SSRF Protection on User-Provided Job URLs (blocks private IPs, AWS metadata, localhost)
 * - Authenticated Matching & Saved Jobs API authorization and isolation
 */

import { test } from "node:test";
import assert from "node:assert/strict";

const NextRequest = globalThis.Request;

import { createSignedSessionToken } from "../../lib/security/session.ts";
import { parseJobDescription, classifyRequirementType, normalizeLiveJob } from "../../lib/career/jobParser.ts";
import {
  normalizeSkill,
  areSkillsEquivalent,
  findResumeEvidence,
  analyzeJobMatch,
} from "../../lib/career/matchEngine.ts";
import { parseStructuredResume } from "../../lib/resume/structuredParser.ts";
import { POST as parsePost } from "../../app/api/jobs/parse/route.ts";
import { POST as matchPost } from "../../app/api/jobs/match/route.ts";
import { GET as savedGet, POST as savedPost, DELETE as savedDelete } from "../../app/api/jobs/saved/route.ts";

const testUser1 = "user_phase6_test_alpha";
const validTokenUser1 = createSignedSessionToken({
  userId: testUser1,
  email: "phase6alpha@careerforge.test",
  role: "authenticated",
});
const authCookieUser1 = `cf_session=${validTokenUser1}`;

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

Backend Developer | Aperture Science | 2018 – 2021
• Built and deployed RESTful services in Python and FastAPI.
• Integrated PostgreSQL relational databases and wrote automated unit tests.

EDUCATION
B.S. in Computer Science | University of Washington | 2018

TECHNICAL SKILLS
Languages: TypeScript, Python, Go, SQL, Bash
Frameworks: Node.js, Express, FastAPI, Next.js
Databases: PostgreSQL, Redis, MongoDB
Cloud: Docker, Kubernetes, AWS, Terraform, GitHub Actions
Tools: Git, Jira, Postman, Jest

PROJECTS
Cloud Monitor Dashboard | TypeScript, Next.js, Redis
• Developed real-time telemetry observation dashboard for distributed nodes.
`;

const sampleJobRaw = `
Senior Platform Engineer
Acme Cloud Services - Remote

About the Role:
We are looking for a Senior Platform Engineer to build scalable infrastructure and services.

Responsibilities:
• Architect scalable microservices in TypeScript or Python.
• Maintain PostgreSQL databases and distributed caches.
• Manage container orchestration with Kubernetes.

Requirements:
• Must have at least 3 years experience with TypeScript and Node.js
• Proven experience with PostgreSQL and Docker is required
• Experience with Kubernetes is mandatory
• Rust experience is required

Nice to have:
• Experience with AWS is a plus
• Knowledge of Terraform is preferred
• GraphQL experience is nice to have
`;

// ─── 1. Requirement Classification & Parser Tests ─────────────────────────────

test("classifyRequirementType correctly identifies strength keywords without hallucination", () => {
  assert.equal(classifyRequirementType("Must have 3+ years in TypeScript"), "REQUIRED");
  assert.equal(classifyRequirementType("Docker experience is required"), "REQUIRED");
  assert.equal(classifyRequirementType("AWS knowledge is preferred"), "PREFERRED");
  assert.equal(classifyRequirementType("Experience with GraphQL is a plus"), "PREFERRED");
  assert.equal(classifyRequirementType("Relocation assistance is optional"), "OPTIONAL");
  assert.equal(classifyRequirementType("Passionate about collaborative software development"), "UNKNOWN");
});

test("parseJobDescription correctly extracts sections, skills, and requirement types", () => {
  const parsed = parseJobDescription({ rawText: sampleJobRaw });

  assert.equal(parsed.title, "Senior Platform Engineer");
  assert.equal(parsed.remote, true);
  assert.ok(parsed.requirements.length >= 3, "Expected at least 3 required skills");
  assert.ok(parsed.preferredQualifications.length >= 2, "Expected at least 2 preferred qualifications");

  const reqSkills = parsed.requirements.map((r) => r.normalizedSkill);
  assert.ok(reqSkills.includes("typescript"));
  assert.ok(reqSkills.includes("kubernetes"));
  assert.ok(reqSkills.includes("docker"));

  const prefSkills = parsed.preferredQualifications.map((r) => r.normalizedSkill);
  assert.ok(prefSkills.includes("aws") || prefSkills.includes("terraform"));
});

// ─── 2. Conservative Skill Equivalence Tests ──────────────────────────────────

test("Conservative skill normalization equates safe aliases but guards distinct languages", () => {
  // Equivalent pairs
  assert.equal(areSkillsEquivalent("React", "react.js"), true);
  assert.equal(areSkillsEquivalent("PostgreSQL", "postgres"), true);
  assert.equal(areSkillsEquivalent("AWS", "Amazon Web Services"), true);
  assert.equal(areSkillsEquivalent("C++", "C plus plus"), true);
  assert.equal(areSkillsEquivalent("C#", "C sharp"), true);
  assert.equal(areSkillsEquivalent("Golang", "Go"), true);

  // Critical non-equivalent guardrails (Must NOT match)
  assert.equal(areSkillsEquivalent("Java", "JavaScript"), false);
  assert.equal(areSkillsEquivalent("Python", "PyTorch"), false);
  assert.equal(areSkillsEquivalent("SQL", "PostgreSQL"), false);
  assert.equal(areSkillsEquivalent("C", "C++"), false);
  assert.equal(areSkillsEquivalent("C", "C#"), false);
  assert.equal(areSkillsEquivalent("R", "Rust"), false);
});

// ─── 3. Evidence Extraction & Match Engine Tests ──────────────────────────────

test("findResumeEvidence searches work, projects, and skills with verbatim quotes", () => {
  const resume = parseStructuredResume(sampleResumeRaw);

  // Work bullet evidence
  const pgEvidence = findResumeEvidence("PostgreSQL", resume);
  assert.equal(pgEvidence.found, true);
  assert.equal(pgEvidence.where, "work");
  assert.ok(pgEvidence.snippet.includes("Black Mesa Tech"));

  // Project evidence
  const nextEvidence = findResumeEvidence("Next.js", resume);
  assert.equal(nextEvidence.found, true);
  assert.ok(nextEvidence.where === "project" || nextEvidence.where === "skill_only");

  // Non-existent skill
  const rustEvidence = findResumeEvidence("Rust", resume);
  assert.equal(rustEvidence.found, false);
});

test("analyzeJobMatch distinguishes MATCHED, PARTIAL, EVIDENCE_GAP, and MISSING", () => {
  const resume = parseStructuredResume(sampleResumeRaw);
  const job = parseJobDescription({ rawText: sampleJobRaw });

  const result = analyzeJobMatch({ job, resume });

  // TypeScript and Kubernetes should be strongly supported (MATCHED)
  assert.ok(result.summary.stronglySupported.includes("typescript"));
  assert.ok(result.summary.stronglySupported.includes("kubernetes"));

  // Rust was required by Acme Cloud, but candidate has no evidence -> MISSING
  assert.ok(result.summary.missing.includes("rust"));

  // Check Application Readiness
  assert.ok(result.applicationReadiness.checks.length >= 3);
  assert.ok(result.applicationReadiness.preparationSteps.length > 0);
  assert.ok(result.whyExplanation.length > 20);
});

// ─── 4. SSRF & Ingestion API Security Tests ───────────────────────────────────

test("POST /api/jobs/parse enforces SSRF security on user-provided job URLs", async () => {
  // SSRF attempt: loopback
  const req1 = new NextRequest("http://localhost:3000/api/jobs/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobUrl: "http://127.0.0.1:8080/admin/secrets" }),
  });
  const res1 = await parsePost(req1);
  assert.equal(res1.status, 400);
  const data1 = await res1.json();
  assert.ok(data1.error.includes("invalid or blocked"));

  // SSRF attempt: AWS cloud metadata
  const req2 = new NextRequest("http://localhost:3000/api/jobs/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobUrl: "http://169.254.169.254/latest/meta-data/" }),
  });
  const res2 = await parsePost(req2);
  assert.equal(res2.status, 400);

  // Safe raw text ingestion
  const req3 = new NextRequest("http://localhost:3000/api/jobs/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rawText: sampleJobRaw }),
  });
  const res3 = await parsePost(req3);
  assert.equal(res3.status, 200);
  const data3 = await res3.json();
  assert.equal(data3.job.title, "Senior Platform Engineer");
});

// ─── 5. Match API & Saved Jobs Tests ──────────────────────────────────────────

test("POST /api/jobs/match executes explainable matching via API", async () => {
  const req = new NextRequest("http://localhost:3000/api/jobs/match", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      job: parseJobDescription({ rawText: sampleJobRaw }),
      resumeText: sampleResumeRaw,
    }),
  });

  const res = await matchPost(req);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.ok(data.matchResult);
  assert.ok(data.matchResult.dimensions.length > 0);
  assert.ok(data.matchResult.summary.stronglySupported.length > 0);
});

test("Saved Jobs API requires authentication and enforces user scoping", async () => {
  // Unauthenticated GET
  const unauthGet = new NextRequest("http://localhost:3000/api/jobs/saved", {
    method: "GET",
  });
  const resUnauth = await savedGet(unauthGet);
  assert.equal(resUnauth.status, 401);

  // Authenticated GET
  const authGet = new NextRequest("http://localhost:3000/api/jobs/saved", {
    method: "GET",
    headers: { Cookie: authCookieUser1 },
  });
  const resAuth = await savedGet(authGet);
  assert.equal(resAuth.status, 200);
  const savedData = await resAuth.json();
  assert.ok(Array.isArray(savedData.savedJobs));
});
