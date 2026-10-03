/**
 * tests/unit/phase5_resume_system.test.mjs
 *
 * Phase 5 Resume System Verification Test Suite:
 * - Deterministic, tolerant structured resume parser extraction
 * - Fact-preserving optimization without hallucinated statistics
 * - Authentication and ownership scoping for Save, Get, and Delete operations
 * - Conversion to standard JSON Resume schema v1.0.0
 * - Accessible reordering invariants
 */

import { test } from "node:test";
import assert from "node:assert/strict";

const NextRequest = globalThis.Request;

import { createSignedSessionToken } from "../../lib/security/session.ts";
import { parseStructuredResume, categorizeSkills } from "../../lib/resume/structuredParser.ts";
import { GET as saveGet, DELETE as saveDelete, POST as savePost } from "../../app/api/resume/save/route.ts";
import { POST as optimizePost } from "../../app/api/resume/optimize/route.ts";
import { POST as jsonResumePost } from "../../app/api/resume/jsonresume/route.ts";

const testUser1 = "user_phase5_owner_alpha";
const validTokenUser1 = createSignedSessionToken({
  userId: testUser1,
  email: "alpha@careerforge.test",
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
Honors: Magna Cum Laude • GPA 3.9/4.0

TECHNICAL SKILLS
Languages: TypeScript, Python, Go, SQL, Bash
Frameworks: Node.js, Express, FastAPI, React
Databases: PostgreSQL, Redis, MongoDB
Cloud: Docker, Kubernetes, AWS, Terraform, GitHub Actions
Tools: Git, Jira, Postman, Jest

PROJECTS
Portal Stream [TypeScript, WebSockets] | https://github.com/elenavance/portal-stream
• Real-time data pipeline streaming telemetry metrics.

CERTIFICATIONS
AWS Certified Solutions Architect | Amazon Web Services | 2022
`;

test("Phase 5: Structured Parser accurately extracts candidate basics without hallucinations", () => {
  const structured = parseStructuredResume(sampleResumeRaw);

  assert.equal(structured.basics.name, "ELENA VANCE");
  assert.equal(structured.basics.email, "elena.vance@example.com");
  assert.equal(structured.basics.phone, "(555) 314-1592");
  assert.equal(structured.basics.location, "Seattle, WA");
  assert.equal(structured.basics.linkedIn, "https://linkedin.com/in/elenavance");
  assert.equal(structured.basics.github, "https://github.com/elenavance");
  assert.match(structured.basics.summary, /Senior Backend Engineer/i);
});

test("Phase 5: Structured Parser categorizes technical skills correctly into domain dictionaries", () => {
  const structured = parseStructuredResume(sampleResumeRaw);

  assert.ok(structured.skills.categorized.languages.includes("TypeScript") || structured.skills.categorized.languages.includes("typescript"));
  assert.ok(structured.skills.categorized.languages.includes("Python") || structured.skills.categorized.languages.includes("python"));
  assert.ok(structured.skills.categorized.databases.includes("PostgreSQL") || structured.skills.categorized.databases.includes("postgresql"));
  assert.ok(structured.skills.categorized.databases.includes("Redis") || structured.skills.categorized.databases.includes("redis"));
  assert.ok(structured.skills.categorized.cloud.includes("Docker") || structured.skills.categorized.cloud.includes("docker"));
  assert.ok(structured.skills.categorized.cloud.includes("Kubernetes") || structured.skills.categorized.cloud.includes("kubernetes"));
});

test("Phase 5: Structured Parser extracts work experience items and bullet points", () => {
  const structured = parseStructuredResume(sampleResumeRaw);

  assert.ok(structured.work.length >= 2, `Expected at least 2 experience items, got ${structured.work.length}`);
  const leadRole = structured.work.find((w) => w.role.toLowerCase().includes("lead") || w.company.toLowerCase().includes("black mesa"));
  assert.ok(leadRole, "Expected to find Black Mesa / Lead role");
  assert.equal(leadRole.current, true);
  assert.match(leadRole.bullets, /microservices/i);
});

test("Phase 5: Structured Parser extracts education, degrees, and honors", () => {
  const structured = parseStructuredResume(sampleResumeRaw);

  assert.ok(structured.education.length >= 1, "Expected at least 1 education item");
  const edu = structured.education[0];
  assert.match(edu.institution, /University of Washington/i);
  assert.match(edu.degree, /b\.?s\.?/i);
  assert.match(edu.graduationYear, /2018/);
  assert.match(edu.gpaOrHonors, /3\.9|Magna/i);
});

test("Phase 5: Structured Parser leaves missing fields empty instead of hallucinating data", () => {
  const sparseText = `
John Doe
john@example.com
Software Developer with experience in React.
`;
  const structured = parseStructuredResume(sparseText);

  assert.equal(structured.basics.name, "John Doe");
  assert.equal(structured.basics.email, "john@example.com");
  assert.equal(structured.basics.phone, "");
  assert.equal(structured.basics.location, "");
  assert.equal(structured.basics.linkedIn, "");
  assert.equal(structured.basics.github, "");
  assert.equal(structured.work.length, 0);
  assert.equal(structured.education.length, 0);
  assert.equal(structured.certifications.length, 0);
});

test("Phase 5: Optimization API preserves factual integrity and provides metric prompts without fake statistics", async () => {
  const req = new NextRequest("http://localhost:3000/api/resume/optimize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: authCookieUser1,
    },
    body: JSON.stringify({
      text: "Made a website using React.",
      role: "frontend",
      type: "bullet",
    }),
  });

  const res = await optimizePost(req);
  assert.equal(res.status, 200);
  const data = await res.json();

  assert.ok(typeof data.optimized === "string");
  // Invariant: Must NOT fabricate fake metrics like "34% across 10k+ sessions"
  assert.doesNotMatch(data.optimized, /34% across 10k\+ active sessions/);
  assert.doesNotMatch(data.optimized, /42% and eliminating critical/);
  // Invariant: Contains actionable metric guidance
  assert.ok(data.metricPrompt || data.optimized.includes("["));
});

test("Phase 5: Optimization API rejects unauthenticated requests with 401", async () => {
  const req = new NextRequest("http://localhost:3000/api/resume/optimize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: "Wrote backend microservices.",
      role: "backend",
      type: "bullet",
    }),
  });

  const res = await optimizePost(req);
  assert.equal(res.status, 401);
});

test("Phase 5: GET /api/resume/save requires authentication", async () => {
  const unauthReq = new NextRequest("http://localhost:3000/api/resume/save", {
    method: "GET",
  });
  const res = await saveGet(unauthReq);
  assert.equal(res.status, 401);
});

test("Phase 5: DELETE /api/resume/save requires authentication and valid ID", async () => {
  // 1. Unauthenticated -> 401
  const unauthReq = new NextRequest("http://localhost:3000/api/resume/save?id=res_123", {
    method: "DELETE",
  });
  const res1 = await saveDelete(unauthReq);
  assert.equal(res1.status, 401);

  // 2. Authenticated but missing id -> 400
  const missingIdReq = new NextRequest("http://localhost:3000/api/resume/save", {
    method: "DELETE",
    headers: { Cookie: authCookieUser1 },
  });
  const res2 = await saveDelete(missingIdReq);
  assert.equal(res2.status, 400);
});

test("Phase 5: POST /api/resume/jsonresume converts canonical data into standard JSONResume schema", async () => {
  const req = new NextRequest("http://localhost:3000/api/resume/jsonresume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "Alex Rivera",
      headline: "Senior Frontend Engineer",
      email: "alex@example.com",
      skills: "React, TypeScript, Next.js",
      experiences: [
        {
          role: "Frontend Lead",
          company: "Tech Corp",
          startDate: "2021",
          endDate: "Present",
          bullets: "Architected modern design system\nOptimized Core Web Vitals",
        },
      ],
    }),
  });

  const res = await jsonResumePost(req);
  assert.equal(res.status, 200);
  const json = await res.json();

  assert.equal(json.status, "success");
  assert.equal(json.data.basics.name, "Alex Rivera");
  assert.equal(json.data.basics.email, "alex@example.com");
  assert.equal(json.data.work[0].name, "Tech Corp");
  assert.equal(json.data.work[0].position, "Frontend Lead");
  assert.ok(Array.isArray(json.data.work[0].highlights));
});
