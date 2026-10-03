/**
 * lib/interview/rejectionAnalysis.ts
 *
 * UBIX Evidence-Based Rejection Analysis Engine
 *
 * Evaluates candidate rejection notices by cross-referencing known job requirements
 * with verified candidate evidence.
 *
 * STRICT INVARIANT: NEVER INVENTS EMPLOYER REASONING.
 * Identifies only objective, empirical factors (e.g. required skill deficit,
 * experience year difference) or returns UNKNOWN when company feedback is absent.
 */

import { NormalizedJobRequirement } from "../jobs/requirementExtraction";
import { SkillEvidenceItem } from "../career/evidenceWallet";

export type RejectionFactorCategory =
  | "SKILL_REQUIREMENT_GAP"
  | "YEARS_EXPERIENCE_GAP"
  | "LOCATION_OR_WORK_MODE_MISALIGNMENT"
  | "UNKNOWN_INTERNAL_REASONING";

export interface RejectionFactor {
  category: RejectionFactorCategory;
  description: string;
  isGroundedInKnownEvidence: boolean;
  actionableFollowUp: string;
}

export interface RejectionAnalysisReport {
  company: string;
  roleTitle: string;
  identifiedFactors: RejectionFactor[];
  isEmployerFeedbackProvided: boolean;
  employerDisclosedText?: string;
  constructiveSummary: string;
  encouragementGuidance: string;
}

/**
 * Analyzes an application rejection based solely on known facts.
 */
export function analyzeRejectionNotice(input: {
  company: string;
  roleTitle: string;
  jobRequirement?: NormalizedJobRequirement;
  candidateEvidence: SkillEvidenceItem[];
  candidateYearsExperience?: number;
  employerEmailText?: string;
}): RejectionAnalysisReport {
  const identifiedFactors: RejectionFactor[] = [];
  const knownSkills = new Set(
    input.candidateEvidence
      .filter((e) => e.status === "CONFIRMED")
      .map((e) => e.skillName.toLowerCase())
  );

  let hasDisclosedFeedback = false;
  if (input.employerEmailText && input.employerEmailText.length > 20) {
    hasDisclosedFeedback = true;
  }

  // 1. Check known required skills against verified wallet
  if (input.jobRequirement && input.jobRequirement.requiredSkills.length > 0) {
    const missingSkills = input.jobRequirement.requiredSkills.filter(
      (s) => !knownSkills.has(s.toLowerCase())
    );

    if (missingSkills.length > 0) {
      identifiedFactors.push({
        category: "SKILL_REQUIREMENT_GAP",
        description: `Role explicitly required: ${missingSkills.join(", ")}, which are currently unverified in your Evidence Wallet.`,
        isGroundedInKnownEvidence: true,
        actionableFollowUp: `Build a project or complete practical assessment covering ${missingSkills[0]}.`,
      });
    }
  }

  // 2. Check stated experience gap
  if (
    input.jobRequirement &&
    typeof input.jobRequirement.minimumYearsExperience === "number" &&
    typeof input.candidateYearsExperience === "number"
  ) {
    if (input.candidateYearsExperience < input.jobRequirement.minimumYearsExperience) {
      const diff = input.jobRequirement.minimumYearsExperience - input.candidateYearsExperience;
      identifiedFactors.push({
        category: "YEARS_EXPERIENCE_GAP",
        description: `Posting listed a ${input.jobRequirement.minimumYearsExperience} year minimum; your profile records ${input.candidateYearsExperience} years (${diff} year differential).`,
        isGroundedInKnownEvidence: true,
        actionableFollowUp: "Highlight demonstrable production complexity to compensate for formal tenure requirements.",
      });
    }
  }

  // 3. Fallback when internal decision was not explained by the company
  if (identifiedFactors.length === 0 || !hasDisclosedFeedback) {
    identifiedFactors.push({
      category: "UNKNOWN_INTERNAL_REASONING",
      description: "The employer did not provide individual technical feedback. Hiring outcomes frequently involve internal hiring freezes, referral pipelines, or shifting budget priorities.",
      isGroundedInKnownEvidence: true,
      actionableFollowUp: "Avoid speculating on unknown factors. Continue targeting roles with high evidence alignment.",
    });
  }

  return {
    company: input.company,
    roleTitle: input.roleTitle,
    identifiedFactors,
    isEmployerFeedbackProvided: hasDisclosedFeedback,
    employerDisclosedText: input.employerEmailText,
    constructiveSummary: `Analysis of ${input.company} rejection: ${identifiedFactors.map((f) => f.description).join(" ")}`,
    encouragementGuidance: "Rejections are a standard component of software hiring pipelines. Stay focused on building verifiable artifacts.",
  };
}
