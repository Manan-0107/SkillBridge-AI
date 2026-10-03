/**
 * lib/resume/automatedMaintenance.ts
 *
 * UBIX Automated Resume Maintenance Engine
 *
 * Synchronizes verified career evidence changes with resume drafts.
 * Prepares suggested updates while strictly enforcing CONFIRMATION_REQUIRED
 * before modifying any externally used resume content.
 */

import { SkillEvidence } from "../career/evidenceWallet";
import { translateEvidenceToResumeBullet, TranslatedResumeBullet } from "./achievementTranslator";

export interface ResumeSectionProposal {
  sectionName: "skills" | "projects" | "experience" | "certifications";
  changeType: "ADD" | "UPDATE" | "VERIFY";
  proposedContent: string;
  sourceEvidenceId: string;
  sourceEvidenceSkill: string;
  rationale: string;
}

export interface ResumeUpdatePlan {
  planId: string;
  userId: string;
  affectedSections: string[];
  proposals: ResumeSectionProposal[];
  generatedBullets: TranslatedResumeBullet[];
  permissionLevel: "CONFIRMATION_REQUIRED";
  status: "WAITING_FOR_CONFIRMATION";
  createdAt: string;
  expiresAt: string;
}

/**
 * Evaluates newly added or updated verified evidence and generates a structured
 * resume update proposal requiring explicit user confirmation.
 */
export function evaluateResumeUpdatesForEvidence(input: {
  userId: string;
  newEvidence: SkillEvidence[];
  currentResumeSkills?: string[];
}): ResumeUpdatePlan {
  const currentSkills = new Set((input.currentResumeSkills || []).map((s) => s.toLowerCase()));
  const proposals: ResumeSectionProposal[] = [];
  const generatedBullets: TranslatedResumeBullet[] = [];
  const affectedSectionsSet = new Set<string>();

  for (const ev of input.newEvidence) {
    if (ev.status !== "CONFIRMED") {
      continue;
    }

    const normSkill = ev.skillName.toLowerCase();
    const bullet = translateEvidenceToResumeBullet(ev);
    generatedBullets.push(bullet);

    // 1. Skill Section Proposal
    if (!currentSkills.has(normSkill)) {
      affectedSectionsSet.add("skills");
      proposals.push({
        sectionName: "skills",
        changeType: "ADD",
        proposedContent: ev.skillName,
        sourceEvidenceId: ev.id,
        sourceEvidenceSkill: ev.skillName,
        rationale: `Verified competence in ${ev.skillName} achieved via ${ev.source} (${Math.round(ev.confidence * 100)}% confidence).`,
      });
    }

    // 2. Project or Experience Section Proposal
    affectedSectionsSet.add("projects");
    proposals.push({
      sectionName: "projects",
      changeType: "ADD",
      proposedContent: bullet.bulletText,
      sourceEvidenceId: ev.id,
      sourceEvidenceSkill: ev.skillName,
      rationale: `Evidence item ${ev.id} provides verified deliverables for ${ev.skillName}.`,
    });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  return {
    planId: `rup_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    userId: input.userId,
    affectedSections: Array.from(affectedSectionsSet),
    proposals,
    generatedBullets,
    permissionLevel: "CONFIRMATION_REQUIRED",
    status: "WAITING_FOR_CONFIRMATION",
    createdAt: now.toISOString(),
    expiresAt,
  };
}
