/**
 * tests/unit/evolution4_job_intelligence.test.mjs
 *
 * Unit tests verifying Evolution 4:
 * - Market Intelligence & Unfabricated Salary Aggregation
 * - Job Requirement Extraction & Canonical Normalization
 * - Explainable Job Match Breakdown
 * - Objective Job Trust & Scam Signal Detection
 * - Accessibility-Aware Job Matching & Profile Verification
 * - Candidate-Employer Compatibility & Alternative Opportunities
 */

import test from "node:test";
import assert from "node:assert/strict";

import { aggregateMarketIntelligence } from "../../lib/jobs/marketIntelligence.ts";
import { extractAndNormalizeJobPosting } from "../../lib/jobs/requirementExtraction.ts";
import { explainJobMatch } from "../../lib/jobs/matchExplainer.ts";
import { evaluateJobTrust } from "../../lib/jobs/jobTrust.ts";
import { checkPostingAccessibility, createFactualEmployerProfile } from "../../lib/jobs/accessibilityProfiles.ts";
import { findAlternativeOpportunities, evaluateCompatibility } from "../../lib/jobs/opportunitiesBeyond.ts";

test("MarketIntelligence: derives factual stats and returns UNKNOWN when compensation data is missing", () => {
  const emptyReport = aggregateMarketIntelligence("Backend Engineer", []);
  assert.equal(emptyReport.salaryTrend.min, "UNKNOWN");
  assert.equal(emptyReport.salaryTrend.median, "UNKNOWN");
  assert.equal(emptyReport.salaryTrend.provenance, "UNKNOWN");

  const samplePostings = [
    { title: "Node Dev", skills: ["TypeScript", "Docker"], workMode: "REMOTE", salaryMin: 120000, salaryMax: 140000, source: "Greenhouse" },
    { title: "Sr Node Dev", skills: ["TypeScript", "PostgreSQL"], workMode: "REMOTE", salaryMin: 140000, salaryMax: 160000, source: "Greenhouse" },
    { title: "Staff Node Dev", skills: ["TypeScript", "Docker", "Kubernetes"], workMode: "HYBRID", salaryMin: 160000, salaryMax: 180000, source: "Lever" },
  ];

  const report = aggregateMarketIntelligence("Node Developer", samplePostings);
  assert.equal(report.totalActivePostingsAnalyzed, 3);
  assert.equal(report.salaryTrend.provenance, "SOURCE_VERIFIED");
  assert.equal(report.salaryTrend.median, 150000);
  assert.equal(report.workModeBreakdown.remotePercentage, 67);
  assert.ok(report.topInDemandSkills.some((s) => s.skill === "TypeScript" && s.mentionCount === 3));
});

test("RequirementExtraction: normalizes heterogeneous posting into canonical schema", () => {
  const rawDesc = `
    Acme Corp is seeking a Senior Backend Engineer.
    Requirements:
    - 5+ years of experience in distributed systems.
    - Strong proficiency in TypeScript, Docker, and PostgreSQL.
    - Preferred experience with Next.js.
    - Remote flexibility available.
    - Acme is an equal opportunity employer. Reasonable accommodations are provided upon request.
  `;

  const normalized = extractAndNormalizeJobPosting({
    id: "job_123",
    title: "Senior Backend Engineer",
    company: "Acme Corp",
    description: rawDesc,
    sourceProvider: "greenhouse",
    postedAt: new Date().toISOString(),
  });

  assert.equal(normalized.company, "Acme Corp");
  assert.equal(normalized.workMode, "REMOTE");
  assert.equal(normalized.minimumYearsExperience, 5);
  assert.ok(normalized.requiredSkills.includes("TypeScript"));
  assert.ok(normalized.requiredSkills.includes("Docker"));
  assert.ok(normalized.accessibilityClaims.length > 0);
  assert.equal(normalized.freshnessStatus, "FRESH");
});

test("JobMatchExplainer: decomposes match into verifiable evidence and explicit missing skills", () => {
  const mockReq = {
    id: "req_test",
    sourceId: "job_99",
    sourceProvider: "lever",
    title: "Fullstack Engineer",
    role: "Fullstack Engineer",
    company: "Stripe",
    location: "San Francisco, CA",
    workMode: "REMOTE",
    requiredSkills: ["TypeScript", "Docker"],
    preferredSkills: ["PostgreSQL"],
    minimumYearsExperience: 3,
    educationRequirement: "UNKNOWN",
    responsibilities: [],
    accessibilityClaims: [],
    postedAt: new Date().toISOString(),
    extractedAt: new Date().toISOString(),
    rawTextExcerpt: "Build scalable APIs",
    freshnessStatus: "FRESH",
  };

  const mockEvidence = [
    {
      id: "ev_ts",
      userId: "u1",
      skillId: "typescript",
      skillName: "TypeScript",
      source: "GITHUB_REPOSITORY",
      title: "TypeScript Core Repo",
      confidence: 0.9,
      provenance: "SOURCE_VERIFIED",
      status: "CONFIRMED",
      createdAt: new Date().toISOString(),
      description: "Full TS implementation",
    },
  ];

  const explanation = explainJobMatch({
    jobRequirement: mockReq,
    candidateEvidence: mockEvidence,
    candidateYearsExperience: 4,
    candidatePreferredWorkMode: "REMOTE",
  });

  assert.equal(explanation.overallMatchPercentage, 50); // 1 of 2 required skills matched
  assert.equal(explanation.matchedSkills.length, 1);
  assert.equal(explanation.matchedSkills[0].skill, "TypeScript");
  assert.equal(explanation.missingSkills.length, 2); // Docker (required) and PostgreSQL (preferred)
  assert.equal(explanation.experienceAlignment.isAligned, true);
  assert.ok(explanation.recommendedActions[0].includes("Docker"));
});

test("JobTrust: detects authentic ATS sources and flags suspicious payment/wire keywords", () => {
  const legitimateJob = {
    id: "job_legit",
    sourceId: "1",
    sourceProvider: "greenhouse",
    title: "Software Engineer",
    role: "Software Engineer",
    company: "Airbnb",
    location: "Remote",
    workMode: "REMOTE",
    requiredSkills: ["Java"],
    preferredSkills: [],
    minimumYearsExperience: 2,
    educationRequirement: "UNKNOWN",
    responsibilities: ["Develop resilient payment pipelines"],
    accessibilityClaims: [],
    postedAt: new Date().toISOString(),
    extractedAt: new Date().toISOString(),
    rawTextExcerpt: "Join our core infrastructure engineering group.",
    freshnessStatus: "FRESH",
  };

  const legitTrust = evaluateJobTrust(legitimateJob);
  assert.equal(legitTrust.trustLevel, "VERIFIED_SOURCE");
  assert.ok(legitTrust.trustScore >= 80);

  const scamJob = {
    id: "job_scam",
    sourceId: "2",
    sourceProvider: "unverified_board",
    title: "Remote Assistant",
    role: "Remote Assistant",
    company: "Confidential",
    location: "Anywhere",
    workMode: "REMOTE",
    requiredSkills: [],
    preferredSkills: [],
    minimumYearsExperience: 0,
    educationRequirement: "UNKNOWN",
    responsibilities: ["Handle wire transfer and check deposit operations via Telegram chat"],
    accessibilityClaims: [],
    postedAt: new Date().toISOString(),
    extractedAt: new Date().toISOString(),
    rawTextExcerpt: "Kindly contact our hiring manager on Telegram. Must process weekly wire transfer.",
    freshnessStatus: "FRESH",
  };

  const scamTrust = evaluateJobTrust(scamJob);
  assert.equal(scamTrust.trustLevel, "SUSPICIOUS_SIGNALS");
  assert.ok(scamTrust.riskSignals.length >= 2);
  assert.ok(scamTrust.actionGuidance.includes("Caution"));
});

test("AccessibilityProfiles: evaluates explicit accommodations without inferring culture", () => {
  const postingReport = checkPostingAccessibility(
    "job_acc_1",
    "We provide reasonable accommodation for individuals with disabilities. Screen reader accessible test portal available."
  );

  assert.equal(postingReport.hasClearAccommodationStatement, true);
  assert.ok(postingReport.declaredAssistiveTechSupport.length > 0);

  const profile = createFactualEmployerProfile({
    company: "Microsoft",
    accommodationStatement: "Applicants may request accommodations via accommodations@microsoft.com",
    portalTestedScreenReader: true,
    flexibleHours: true,
  });

  assert.equal(profile.hasDocumentedAccommodationProcess, true);
  assert.equal(profile.screenReaderCompatibleApplicationPortal, true);
  assert.equal(profile.sourceEvidence.length, 1);
});

test("OpportunitiesBeyond: finds alternative pathways and checks compatibility without demographic inference", () => {
  const opps = findAlternativeOpportunities({
    skillGaps: ["React", "TypeScript"],
  });

  assert.ok(opps.length > 0);
  assert.equal(opps[0].category, "OPEN_SOURCE");

  const compat = evaluateCompatibility({
    candidateId: "user_cand_1",
    employerName: "Meta",
    matchedSkillsCount: 4,
    totalRequiredSkillsCount: 5,
    candidateWorkMode: "REMOTE",
    employerWorkMode: "REMOTE",
  });

  assert.equal(compat.technicalCompatibilityPercentage, 80);
  assert.equal(compat.workModeCompatibility, "ALIGNED");
  assert.equal(compat.isViable, true);
});
