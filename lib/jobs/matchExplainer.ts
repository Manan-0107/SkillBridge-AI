/**
 * lib/jobs/matchExplainer.ts
 *
 * UBIX Job Match Explainer
 *
 * Deconstructs match decisions into fully explainable, transparent components.
 * Strictly avoids ungrounded black-box AI scores by detailing:
 * - Direct matched skills with supporting evidence references
 * - Missing prerequisite and secondary skill gaps
 * - Work mode and geographic alignment
 * - Concrete actionable recommendations to bridge any deficits
 */

import { SkillEvidenceItem } from "../career/evidenceWallet";
import { NormalizedJobRequirement } from "./requirementExtraction";

export interface SkillMatchBreakdown {
  skill: string;
  isMatched: boolean;
  isRequired: boolean;
  evidenceItems: Array<{
    id: string;
    source: string;
    confidence: number;
    title: string;
  }>;
}

export interface JobMatchExplanation {
  jobId: string;
  roleTitle: string;
  company: string;
  overallMatchPercentage: number;
  matchedSkills: SkillMatchBreakdown[];
  missingSkills: SkillMatchBreakdown[];
  experienceAlignment: {
    requiredYears: number | "UNKNOWN";
    candidateYears: number;
    isAligned: boolean;
    explanation: string;
  };
  workModeAlignment: {
    jobWorkMode: string;
    preferredWorkMode: string;
    isAligned: boolean;
  };
  locationAlignment: {
    jobLocation: string;
    candidateLocation: string;
    isAligned: boolean;
  };
  explainableSummary: string;
  recommendedActions: string[];
}

/**
 * Computes an explainable job match evaluation.
 */
export function explainJobMatch(input: {
  jobRequirement: NormalizedJobRequirement;
  candidateEvidence: SkillEvidenceItem[];
  candidateYearsExperience?: number;
  candidateLocation?: string;
  candidatePreferredWorkMode?: "REMOTE" | "HYBRID" | "ONSITE" | "ANY";
}): JobMatchExplanation {
  const req = input.jobRequirement;
  const evidenceMap = new Map<string, SkillEvidenceItem[]>();

  // Group candidate's verified evidence by lowercase skill name
  input.candidateEvidence
    .filter((e) => e.status === "CONFIRMED")
    .forEach((e) => {
      const key = e.skillName.toLowerCase();
      if (!evidenceMap.has(key)) evidenceMap.set(key, []);
      evidenceMap.get(key)!.push(e);
    });

  const matchedSkills: SkillMatchBreakdown[] = [];
  const missingSkills: SkillMatchBreakdown[] = [];

  const allJobSkills = [
    ...req.requiredSkills.map((s) => ({ name: s, isRequired: true })),
    ...req.preferredSkills.map((s) => ({ name: s, isRequired: false })),
  ];

  let matchedRequiredCount = 0;
  let totalRequiredCount = 0;

  allJobSkills.forEach(({ name, isRequired }) => {
    if (isRequired) totalRequiredCount++;
    const key = name.toLowerCase();
    const items = evidenceMap.get(key) || [];

    if (items.length > 0) {
      if (isRequired) matchedRequiredCount++;
      matchedSkills.push({
        skill: name,
        isMatched: true,
        isRequired,
        evidenceItems: items.map((i) => ({
          id: i.id,
          source: i.source,
          confidence: i.confidence,
          title: i.title,
        })),
      });
    } else {
      missingSkills.push({
        skill: name,
        isMatched: false,
        isRequired,
        evidenceItems: [],
      });
    }
  });

  const overallPercentage =
    totalRequiredCount > 0
      ? Math.round((matchedRequiredCount / totalRequiredCount) * 100)
      : matchedSkills.length > 0
      ? 100
      : 50;

  // Experience Alignment
  const candYears = input.candidateYearsExperience ?? 0;
  const reqYears = req.minimumYearsExperience;
  let isExpAligned = true;
  let expExplanation = "No strict years of experience specified.";

  if (typeof reqYears === "number") {
    isExpAligned = candYears >= reqYears;
    expExplanation = isExpAligned
      ? `Candidate holds ${candYears} years experience, satisfying the ${reqYears} year minimum.`
      : `Candidate holds ${candYears} years experience, currently below the stated ${reqYears} year target.`;
  }

  // Work Mode Alignment
  const candWorkMode = input.candidatePreferredWorkMode || "ANY";
  const isWorkModeAligned =
    candWorkMode === "ANY" ||
    req.workMode === "UNKNOWN" ||
    req.workMode === candWorkMode ||
    (req.workMode === "REMOTE" && candWorkMode !== "ONSITE");

  // Location Alignment
  const candLoc = (input.candidateLocation || "").toLowerCase();
  const jobLoc = req.location.toLowerCase();
  const isLocAligned =
    req.workMode === "REMOTE" ||
    !candLoc ||
    jobLoc === "unknown" ||
    jobLoc.includes(candLoc) ||
    candLoc.includes(jobLoc);

  // Recommendations
  const recommendedActions: string[] = [];
  if (missingSkills.some((s) => s.isRequired)) {
    const missingReqNames = missingSkills.filter((s) => s.isRequired).map((s) => s.skill).join(", ");
    recommendedActions.push(`Acquire verifiable evidence for primary required skill(s): ${missingReqNames}.`);
  }
  if (!isExpAligned && typeof reqYears === "number") {
    recommendedActions.push(`Highlight impactful open-source or complex projects to compensate for the ${reqYears - candYears} year experience gap.`);
  }

  const summary = `Match Score: ${overallPercentage}%. Candidate matches ${matchedRequiredCount} of ${totalRequiredCount || matchedSkills.length} required skills with verified wallet evidence. Experience alignment: ${isExpAligned ? "Qualified" : "Gap identified"}.`;

  return {
    jobId: req.id,
    roleTitle: req.title,
    company: req.company,
    overallMatchPercentage: overallPercentage,
    matchedSkills,
    missingSkills,
    experienceAlignment: {
      requiredYears: reqYears,
      candidateYears: candYears,
      isAligned: isExpAligned,
      explanation: expExplanation,
    },
    workModeAlignment: {
      jobWorkMode: req.workMode,
      preferredWorkMode: candWorkMode,
      isAligned: isWorkModeAligned,
    },
    locationAlignment: {
      jobLocation: req.location,
      candidateLocation: input.candidateLocation || "UNKNOWN",
      isAligned: isLocAligned,
    },
    explainableSummary: summary,
    recommendedActions,
  };
}
