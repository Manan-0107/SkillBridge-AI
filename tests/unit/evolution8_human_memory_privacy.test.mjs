/**
 * tests/unit/evolution8_human_memory_privacy.test.mjs
 *
 * Unit tests verifying Evolution 8:
 * - Human Support Network & Mentor Matching
 * - Human Help Bridge (Explicit Handoff with Accessibility Context)
 * - Sovereign Portable Career Profile (Zero-Vendor Lock-in, Accessible Text)
 * - Automation Permissions & Emergency Kill Switch
 */

import test from "node:test";
import assert from "node:assert/strict";

import { findMatchingMentors } from "../../lib/human/mentorNetwork.ts";
import { createHumanHandoffTicket } from "../../lib/human/helpBridge.ts";
import {
  buildPortableCareerProfile,
  exportToAccessibleText,
} from "../../lib/privacy/portableProfile.ts";
import {
  getUserAutomationPolicy,
  updateUserAutomationPolicy,
  isAutomationPermitted,
} from "../../lib/privacy/automationPermissions.ts";
import { createPassportForProfile } from "../../lib/accessibility/passport.ts";

test("MentorNetwork: matches mentors by skill and lived accessibility experience without AI impersonation", () => {
  const a11yMentors = findMatchingMentors({
    desiredTopics: ["ACCESSIBILITY_NAV"],
    skillGaps: ["React"],
    preferAccessibilityExperience: true,
  });

  assert.ok(a11yMentors.length > 0);
  assert.equal(a11yMentors[0].hasLivedAccessibilityExperience, true);
  assert.equal(a11yMentors[0].fullName, "David Kim");

  const infraMentors = findMatchingMentors({
    desiredTopics: ["SYSTEM_DESIGN"],
    skillGaps: ["Kubernetes"],
  });
  assert.ok(infraMentors.some((m) => m.company === "GitHub"));
});

test("HelpBridge: packages user-approved context and rejects unauthorized handoffs", () => {
  const passport = createPassportForProfile("blind_low_vision");

  // Attempting handoff without explicit user approval must throw
  assert.throws(
    () => {
      createHumanHandoffTicket({
        userId: "u_help_1",
        candidateGoal: "Senior Backend Engineer",
        activeWorkflow: "ROADMAP_PLANNING",
        problemDescription: "Prerequisite circular dependency query",
        recentRelevantActions: ["Viewed Roadmap", "Selected Docker Milestone"],
        passport,
        userExplicitlyApproved: false,
      });
    },
    /REJECTED: Human handoff requires explicit user approval/
  );

  // With approval succeeds and includes screen reader accommodation
  const ticket = createHumanHandoffTicket({
    userId: "u_help_1",
    candidateGoal: "Senior Backend Engineer",
    activeWorkflow: "ROADMAP_PLANNING",
    problemDescription: "Prerequisite query",
    recentRelevantActions: ["Viewed Roadmap", "Selected Docker Milestone"],
    passport,
    userExplicitlyApproved: true,
  });

  assert.equal(ticket.ticketStatus, "OPEN");
  assert.equal(ticket.accessibilityAccommodations.requiresScreenReaderSupport, true);
  assert.ok(ticket.relevantContextSummary.includes("Docker Milestone"));
});

test("PortableProfile: generates sovereign export and formats accessible plain text", () => {
  const passport = createPassportForProfile("standard");
  const mockEvidence = [
    {
      id: "ev_1",
      userId: "u_port_1",
      skillId: "typescript",
      skillName: "TypeScript",
      source: "GITHUB_REPOSITORY",
      status: "CONFIRMED",
      title: "Core TS API",
      description: "Implemented enterprise backend",
      confidence: 0.9,
      createdAt: new Date().toISOString(),
    },
  ];

  const pkg = buildPortableCareerProfile({
    userId: "u_port_1",
    targetRole: "Full Stack Engineer",
    passport,
    evidenceItems: mockEvidence,
  });

  assert.equal(pkg.formatVersion, "1.0.0");
  assert.equal(pkg.verifiedSkills.length, 1);
  assert.equal(pkg.verifiedSkills[0].skillName, "TypeScript");

  const textExport = exportToAccessibleText(pkg);
  assert.ok(textExport.includes("UBIX SOVEREIGN CAREER PROFILE EXPORT"));
  assert.ok(textExport.includes("TypeScript: Verified via GITHUB_REPOSITORY"));
  assert.ok(textExport.includes("ACCESSIBILITY PASSPORT PREFERENCES"));
});

test("AutomationPermissions: enforces granular toggles and emergency kill switch", () => {
  const userId = "u_perm_test";

  // Initial state allows analysis
  const initialCheck = isAutomationPermitted(userId, "SKILL_ANALYSIS");
  assert.equal(initialCheck.isAllowed, true);

  // User disables job monitoring
  updateUserAutomationPolicy(userId, { allowAutomatedJobMonitoring: false });
  const jobCheck = isAutomationPermitted(userId, "JOB_MONITORING");
  assert.equal(jobCheck.isAllowed, false);
  assert.ok(jobCheck.reason?.includes("disabled background job monitoring"));

  // Skill analysis remains enabled
  assert.equal(isAutomationPermitted(userId, "SKILL_ANALYSIS").isAllowed, true);

  // Activate Emergency Kill Switch
  updateUserAutomationPolicy(userId, { emergencyKillSwitchAllAutomations: true });
  const killedCheck = isAutomationPermitted(userId, "SKILL_ANALYSIS");
  assert.equal(killedCheck.isAllowed, false);
  assert.ok(killedCheck.reason?.includes("Emergency kill switch is ACTIVE"));
});
