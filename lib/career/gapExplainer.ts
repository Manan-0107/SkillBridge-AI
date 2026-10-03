/**
 * lib/career/gapExplainer.ts
 *
 * UBIX Career Gap Explainer
 *
 * Provides evidence-backed explanations for every identified skill gap:
 * - Details existing evidence vs missing proof.
 * - Explains practical engineering significance in target role.
 * - Outlines targeted learning, practice, and project recommendations.
 *
 * Invariant: Never produces an unexplained or arbitrary "You need X" assertion.
 */

import { getSkillDefinition, getSkillPrerequisites } from "./skillGraph";
import { SkillEvidenceItem } from "./evidenceWallet";

export interface SkillGapAnalysis {
  skillId: string;
  skillName: string;
  category: string;
  currentEvidenceCount: number;
  existingEvidenceSummary: string;
  missingEvidenceDetails: string;
  whyThisGapMatters: string;
  prerequisitesMet: boolean;
  unmetPrerequisites: string[];
  recommendedLearning: string;
  recommendedPractice: string;
  recommendedProjectIdea: string;
}

/**
 * Produces an evidence-grounded explanation for a skill gap.
 */
export function explainSkillGap(
  targetSkillId: string,
  userEvidence: SkillEvidenceItem[] = [],
  targetRoleTitle = "Target Role"
): SkillGapAnalysis {
  const definition = getSkillDefinition(targetSkillId);
  const skillName = definition?.name || targetSkillId;
  const category = definition?.category || "TECHNICAL";

  // Filter user evidence for this specific skill
  const relevantEvidence = userEvidence.filter(
    (e) => e.skillId === targetSkillId && e.status !== "USER_REJECTED"
  );

  let existingEvidenceSummary = "No documented or verified evidence currently exists in your Evidence Wallet.";
  if (relevantEvidence.length > 0) {
    const verified = relevantEvidence.filter((e) => e.status === "CONFIRMED");
    existingEvidenceSummary = `You hold ${relevantEvidence.length} recorded items (${verified.length} confirmed), including: ${relevantEvidence[0].title}.`;
  }

  const missingEvidenceDetails =
    relevantEvidence.length === 0
      ? `Employers seeking a ${targetRoleTitle} require verifiable project code, assessment scores, or documented production experience.`
      : "Current evidence indicates foundational familiarity, but lacks verified project complexity or production implementation.";

  // Prerequisites check
  const prereqs = getSkillPrerequisites(targetSkillId);
  const heldSkillIds = new Set(userEvidence.map((e) => e.skillId));
  const unmetPrereqs = prereqs.filter((p) => !heldSkillIds.has(p.id)).map((p) => p.name);

  // Practical impact
  let whyThisGapMatters = `As a ${targetRoleTitle}, ${skillName} is a foundational requirement in daily architecture, troubleshooting, and code reviews.`;
  if (targetSkillId === "typescript") {
    whyThisGapMatters = "TypeScript prevents runtime type exceptions and enables safe refactoring in team-scale codebases.";
  } else if (targetSkillId === "docker") {
    whyThisGapMatters = "Docker ensures microservices run consistently between developer laptops and production clusters.";
  } else if (targetSkillId === "postgresql") {
    whyThisGapMatters = "PostgreSQL mastery is critical for writing ACID-compliant transactions and optimizing query latency.";
  }

  return {
    skillId: targetSkillId,
    skillName,
    category,
    currentEvidenceCount: relevantEvidence.length,
    existingEvidenceSummary,
    missingEvidenceDetails,
    whyThisGapMatters,
    prerequisitesMet: unmetPrereqs.length === 0,
    unmetPrerequisites: unmetPrereqs,
    recommendedLearning: `Review official ${skillName} documentation and core architectural patterns.`,
    recommendedPractice: `Complete a 30-minute interactive challenge exercising ${skillName} concepts.`,
    recommendedProjectIdea: `Build a standalone deliverable integrating ${skillName} with your existing stack.`,
  };
}
