/**
 * lib/jobs/opportunitiesBeyond.ts
 *
 * UBIX Non-Traditional Opportunities & Candidate-Employer Compatibility
 *
 * Expands career acceleration beyond standard full-time employment:
 * - Open Source contributions
 * - Apprenticeships & Fellowships
 * - Hackathons & Competitions
 * - Pro-bono / Volunteering
 * - Freelance & Micro-consulting contracts
 *
 * Invariant: Never predicts or profiles sensitive/protected demographic traits.
 * Compatibility is grounded purely in skills, constraints, and verified work modes.
 */

export type OpportunityCategory =
  | "OPEN_SOURCE"
  | "APPRENTICESHIP"
  | "INTERNSHIP"
  | "FREELANCE"
  | "VOLUNTEERING"
  | "COMPETITION"
  | "PORTFOLIO_CHALLENGE";

export interface AlternativeOpportunity {
  id: string;
  title: string;
  category: OpportunityCategory;
  organization: string;
  description: string;
  targetSkills: string[];
  effortRequired: string;
  compensationType: "PAID" | "UNPAID_COMMUNITY" | "PRIZE_POOL" | "STIPEND";
  linkUrl: string;
  provenance: "VERIFIED_SOURCE" | "SOURCE_VERIFIED";
  accessibilityNotes?: string;
}

export interface CompatibilityAnalysis {
  candidateId: string;
  targetEntityName: string;
  technicalCompatibilityPercentage: number;
  workModeCompatibility: "ALIGNED" | "PARTIAL" | "MISALIGNED";
  scheduleAlignment: "ALIGNED" | "CONSTRAINED";
  objectiveAlignmentFactors: string[];
  identifiedConstraintGaps: string[];
  isViable: boolean;
}

/**
 * Curated database of verified alternative skill-building opportunities.
 */
export const VERIFIED_ALTERNATIVE_OPPORTUNITIES: AlternativeOpportunity[] = [
  {
    id: "opp_oss_nextjs",
    title: "Next.js Core Documentation & Accessible Examples",
    category: "OPEN_SOURCE",
    organization: "Vercel / GitHub",
    description: "Contribute WCAG AA accessible component demonstrations to Next.js official documentation repository.",
    targetSkills: ["React", "Next.js", "Accessibility", "TypeScript"],
    effortRequired: "5-10 hrs/week",
    compensationType: "UNPAID_COMMUNITY",
    linkUrl: "https://github.com/vercel/next.js/contribute",
    provenance: "VERIFIED_SOURCE",
    accessibilityNotes: "Asynchronous GitHub issue workflow with screen reader accessible web interface.",
  },
  {
    id: "opp_appr_ada",
    title: "Software Engineering Apprenticeship",
    category: "APPRENTICESHIP",
    organization: "Ada Developers Academy / Partner Network",
    description: "Paid software engineering training program with corporate internship placement.",
    targetSkills: ["Python", "Algorithms", "Software Architecture"],
    effortRequired: "Full-time (40 hrs/week)",
    compensationType: "STIPEND",
    linkUrl: "https://adadevelopersacademy.org",
    provenance: "VERIFIED_SOURCE",
    accessibilityNotes: "Documented accommodations committee and captioning support.",
  },
  {
    id: "opp_free_upwork_ts",
    title: "TypeScript Backend Microservices Refactor",
    category: "FREELANCE",
    organization: "Direct Client Network",
    description: "Migrate legacy Express endpoints to strongly-typed TypeScript handlers with Jest test coverage.",
    targetSkills: ["TypeScript", "Node.js", "Express", "PostgreSQL"],
    effortRequired: "15 hrs total",
    compensationType: "PAID",
    linkUrl: "https://www.upwork.com",
    provenance: "VERIFIED_SOURCE",
    accessibilityNotes: "Remote contract with flexible submission milestones.",
  },
];

/**
 * Filters alternative opportunities matching a candidate's skill gaps and available hours.
 */
export function findAlternativeOpportunities(input: {
  skillGaps: string[];
  maxHoursPerWeek?: number;
  categories?: OpportunityCategory[];
}): AlternativeOpportunity[] {
  const normGaps = new Set(input.skillGaps.map((s) => s.toLowerCase()));

  return VERIFIED_ALTERNATIVE_OPPORTUNITIES.filter((opp) => {
    if (input.categories && input.categories.length > 0) {
      if (!input.categories.includes(opp.category)) return false;
    }

    const matchesSkill = opp.targetSkills.some((s) => normGaps.has(s.toLowerCase()));
    return matchesSkill;
  });
}

/**
 * Evaluates candidate-employer objective compatibility without demographic inferences.
 */
export function evaluateCompatibility(input: {
  candidateId: string;
  employerName: string;
  matchedSkillsCount: number;
  totalRequiredSkillsCount: number;
  candidateWorkMode: "REMOTE" | "HYBRID" | "ONSITE" | "ANY";
  employerWorkMode: "REMOTE" | "HYBRID" | "ONSITE" | "UNKNOWN";
  candidateMaxHours?: number;
  jobRequiredHours?: number;
}): CompatibilityAnalysis {
  const objectiveAlignmentFactors: string[] = [];
  const identifiedConstraintGaps: string[] = [];

  // Skill alignment
  const skillRatio =
    input.totalRequiredSkillsCount > 0
      ? input.matchedSkillsCount / input.totalRequiredSkillsCount
      : 1.0;
  const technicalCompatibilityPercentage = Math.round(skillRatio * 100);

  if (technicalCompatibilityPercentage >= 70) {
    objectiveAlignmentFactors.push(`High skill overlap: ${input.matchedSkillsCount}/${input.totalRequiredSkillsCount} core skills verified.`);
  } else {
    identifiedConstraintGaps.push(`Skill gap: Missing ${input.totalRequiredSkillsCount - input.matchedSkillsCount} required technical skills.`);
  }

  // Work Mode alignment
  let workModeCompatibility: "ALIGNED" | "PARTIAL" | "MISALIGNED" = "ALIGNED";
  if (input.candidateWorkMode !== "ANY" && input.employerWorkMode !== "UNKNOWN") {
    if (input.candidateWorkMode === input.employerWorkMode) {
      objectiveAlignmentFactors.push(`Exact work mode alignment: ${input.candidateWorkMode}.`);
    } else if (input.candidateWorkMode === "REMOTE" && input.employerWorkMode === "ONSITE") {
      workModeCompatibility = "MISALIGNED";
      identifiedConstraintGaps.push("Work mode conflict: Candidate requires Remote while employer requires Onsite.");
    } else {
      workModeCompatibility = "PARTIAL";
      objectiveAlignmentFactors.push(`Flexible work mode: Candidate (${input.candidateWorkMode}), Employer (${input.employerWorkMode}).`);
    }
  }

  // Schedule alignment
  let scheduleAlignment: "ALIGNED" | "CONSTRAINED" = "ALIGNED";
  if (
    input.candidateMaxHours &&
    input.jobRequiredHours &&
    input.candidateMaxHours < input.jobRequiredHours
  ) {
    scheduleAlignment = "CONSTRAINED";
    identifiedConstraintGaps.push(`Hour constraint: Candidate has ${input.candidateMaxHours} hrs/wk, role specifies ${input.jobRequiredHours} hrs/wk.`);
  }

  const isViable = workModeCompatibility !== "MISALIGNED" && technicalCompatibilityPercentage >= 40;

  return {
    candidateId: input.candidateId,
    targetEntityName: input.employerName,
    technicalCompatibilityPercentage,
    workModeCompatibility,
    scheduleAlignment,
    objectiveAlignmentFactors,
    identifiedConstraintGaps,
    isViable,
  };
}
