/**
 * tests/unit/evolution3_projects_portfolio.test.mjs
 *
 * Unit tests verifying Evolution 3:
 * - Project Builder
 * - Portfolio Generator
 * - GitHub Integration & Objective Evidence Extraction
 * - Achievement-to-Resume Translation
 * - Automated Resume Maintenance with Confirmation-Required Planning
 */

import test from "node:test";
import assert from "node:assert/strict";

import { buildProjectProposal } from "../../lib/projects/projectBuilder.ts";
import { generatePortfolioExhibit } from "../../lib/portfolio/portfolioGenerator.ts";
import { extractEvidenceFromGitHubRepos } from "../../lib/integrations/github.ts";
import {
  translateEvidenceToResumeBullet,
  translateEvidenceList,
} from "../../lib/resume/achievementTranslator.ts";
import { evaluateResumeUpdatesForEvidence } from "../../lib/resume/automatedMaintenance.ts";

test("ProjectBuilder: generates structured project targeting Docker skill gap", () => {
  const proposal = buildProjectProposal({
    targetRoleTitle: "Backend Engineer",
    skillGap: "docker",
  });

  assert.equal(proposal.primarySkillGap, "Docker");
  assert.equal(proposal.targetRoleTitle, "Backend Engineer");
  assert.ok(proposal.milestones.length >= 3);
  assert.ok(proposal.totalEstimatedHours > 0);
  assert.equal(proposal.provenance, "GENERATED_PROJECT_SPEC");
  assert.ok(proposal.milestones[0].deliverable.includes("Dockerfile"));
});

test("PortfolioGenerator: generates zero-fabrication exhibit from confirmed wallet items", () => {
  const mockEvidence = [
    {
      id: "ev_1",
      userId: "user_test",
      skillId: "typescript",
      skillName: "TypeScript",
      source: "GITHUB_REPOSITORY",
      title: "TypeScript Backend",
      confidence: 0.85,
      provenance: "SOURCE_VERIFIED",
      status: "CONFIRMED",
      createdAt: "2026-03-01T00:00:00.000Z",
      description: "Engineered scalable REST API in TypeScript",
    },
    {
      id: "ev_2",
      userId: "user_test",
      skillId: "docker",
      skillName: "Docker",
      source: "PROJECT_COMPLETED",
      title: "Docker Orchestration",
      confidence: 0.8,
      provenance: "CONFIRMED",
      status: "CONFIRMED",
      createdAt: "2026-03-02T00:00:00.000Z",
      description: "Deployed containerized services",
    },
  ];

  const exhibit = generatePortfolioExhibit({
    targetRole: "Full Stack Engineer",
    evidenceItems: mockEvidence,
  });

  assert.equal(exhibit.targetRole, "Full Stack Engineer");
  assert.equal(exhibit.totalEvidenceCount, 2);
  assert.ok(exhibit.verifiedSkills.includes("TypeScript"));
  assert.ok(exhibit.verifiedSkills.includes("Docker"));
  assert.equal(exhibit.caseStudies.length, 2);
});

test("GitHubIntegration: extracts evidence without artificially inflating mastery", () => {
  const repos = [
    {
      name: "ubix-core",
      fullName: "manan/ubix-core",
      description: "Accessibility-first career operating system",
      htmlUrl: "https://github.com/manan/ubix-core",
      primaryLanguage: "TypeScript",
      languages: { TypeScript: 85000, CSS: 15000 },
      stargazersCount: 42,
      forksCount: 5,
      isFork: false,
      hasReadme: true,
      hasTests: true,
      hasCiWorkflow: true,
      pushedAt: "2026-03-10T12:00:00.000Z",
    },
    {
      name: "random-fork",
      fullName: "manan/random-fork",
      htmlUrl: "https://github.com/manan/random-fork",
      isFork: true,
    },
  ];

  const result = extractEvidenceFromGitHubRepos(repos);

  // Verifies fork is safely ignored
  assert.equal(result.repoSummaries.length, 1);
  assert.equal(result.warnings.length, 1);
  assert.ok(result.detectedSkills.includes("TypeScript"));

  // Verifies evidence is capped and marked SOURCE_VERIFIED
  const ev = result.evidenceItems.find((e) => e.skillName === "TypeScript");
  assert.ok(ev);
  assert.equal(ev.provenance, "SOURCE_VERIFIED");
  assert.ok(ev.confidence <= 0.85);
});

test("AchievementTranslator: translates evidence into impact bullet points with provenance", () => {
  const ev = {
    id: "ev_test_1",
    userId: "user_test",
    skillId: "postgresql",
    skillName: "PostgreSQL",
    source: "PRACTICE_ASSESSMENT",
    title: "SQL Query Optimization",
    confidence: 0.9,
    provenance: "CONFIRMED",
    status: "CONFIRMED",
    createdAt: "2026-03-01T00:00:00.000Z",
    description: "Optimized complex query execution plans using EXPLAIN ANALYZE",
  };

  const bullet = translateEvidenceToResumeBullet(ev);

  assert.equal(bullet.evidenceId, "ev_test_1");
  assert.equal(bullet.skillName, "PostgreSQL");
  assert.ok(bullet.bulletText.includes("PostgreSQL"));
  assert.ok(bullet.bulletText.includes("EXPLAIN ANALYZE"));
  assert.equal(bullet.provenance, "CONFIRMED");

  const batch = translateEvidenceList([ev]);
  assert.equal(batch.length, 1);
});

test("AutomatedMaintenance: enforces CONFIRMATION_REQUIRED before modifying resume content", () => {
  const newEvidence = [
    {
      id: "ev_new_1",
      userId: "user_789",
      skillId: "docker",
      skillName: "Docker",
      source: "PROJECT_COMPLETED",
      title: "Docker Microservices",
      confidence: 0.85,
      provenance: "CONFIRMED",
      status: "CONFIRMED",
      createdAt: "2026-03-05T00:00:00.000Z",
      description: "Implemented multi-stage Docker builds and compose environments",
    },
  ];

  const updatePlan = evaluateResumeUpdatesForEvidence({
    userId: "user_789",
    newEvidence,
    currentResumeSkills: ["TypeScript", "React"],
  });

  assert.equal(updatePlan.permissionLevel, "CONFIRMATION_REQUIRED");
  assert.equal(updatePlan.status, "WAITING_FOR_CONFIRMATION");
  assert.ok(updatePlan.affectedSections.includes("skills"));
  assert.ok(updatePlan.affectedSections.includes("projects"));
  assert.equal(updatePlan.proposals.length, 2);
  assert.equal(updatePlan.proposals[0].sectionName, "skills");
  assert.equal(updatePlan.proposals[0].proposedContent, "Docker");
});
