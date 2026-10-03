/**
 * lib/career/goalDiscovery.ts
 *
 * UBIX Career Goal Discovery Engine
 *
 * Evaluates candidate interests, existing skills, constraints, and learning preferences
 * to discover viable career pathways.
 *
 * Strict Provenance States:
 * - USER_STATED: Explicitly chosen/entered by candidate.
 * - INFERRED: Recommended by algorithmic analysis; clearly labeled and requires confirmation.
 * - POSSIBLE: High-potential adjacent direction based on skill graph overlap.
 * - UNKNOWN: Incomplete context; never fabricated.
 *
 * Invariant: Never presents an inferred or algorithmic recommendation as a confirmed goal.
 */

import { normalizeSkillName, getSkillDefinition } from "./skillGraph";

export type GoalProvenance = "USER_STATED" | "INFERRED" | "POSSIBLE" | "UNKNOWN";

export interface DiscoveredCareerGoal {
  roleId: string;
  roleTitle: string;
  provenance: GoalProvenance;
  matchScore: number; // 0 to 100
  matchedSkills: string[];
  missingSkills: string[];
  rationale: string;
  estimatedTransitionWeeks: number;
  recommendedNextMilestone: string;
}

const TARGET_ROLE_PROFILES: Record<
  string,
  {
    title: string;
    requiredSkills: string[];
    typicalTimelineWeeks: number;
    description: string;
  }
> = {
  frontend_developer: {
    title: "Frontend Developer",
    requiredSkills: ["javascript", "typescript", "react", "html", "css", "web_accessibility"],
    typicalTimelineWeeks: 12,
    description: "Build accessible, responsive web applications using modern component frameworks.",
  },
  backend_developer: {
    title: "Backend Developer",
    requiredSkills: ["node.js", "python", "postgresql", "docker", "sql"],
    typicalTimelineWeeks: 16,
    description: "Design and implement scalable APIs, databases, and microservices architectures.",
  },
  fullstack_developer: {
    title: "Full-Stack Developer",
    requiredSkills: ["typescript", "react", "node.js", "postgresql", "docker", "html", "css"],
    typicalTimelineWeeks: 20,
    description: "Deliver end-to-end applications bridging interactive user interfaces and robust server services.",
  },
  devops_engineer: {
    title: "DevOps Engineer",
    requiredSkills: ["docker", "postgresql", "python"],
    typicalTimelineWeeks: 18,
    description: "Automate continuous integration, containerization, and reliable cloud deployments.",
  },
};

/**
 * Discovers aligned career goals given candidate's current verified and stated skills.
 */
export function discoverCareerGoals(input: {
  statedGoal?: string;
  knownSkills: string[];
  interests?: string[];
  maxTransitionWeeks?: number;
}): DiscoveredCareerGoal[] {
  const normalizedKnown = new Set(input.knownSkills.map(normalizeSkillName));
  const normalizedStatedGoal = input.statedGoal ? normalizeSkillName(input.statedGoal) : null;

  const results: DiscoveredCareerGoal[] = [];

  for (const [roleId, roleProfile] of Object.entries(TARGET_ROLE_PROFILES)) {
    const required = roleProfile.requiredSkills.map(normalizeSkillName);
    const matched = required.filter((s) => normalizedKnown.has(s));
    const missing = required.filter((s) => !normalizedKnown.has(s));

    const matchScore = Math.round((matched.length / required.length) * 100);

    let provenance: GoalProvenance = "POSSIBLE";
    if (normalizedStatedGoal && roleId.includes(normalizedStatedGoal)) {
      provenance = "USER_STATED";
    } else if (matchScore >= 50) {
      provenance = "INFERRED";
    }

    const matchedNames = matched.map((id) => getSkillDefinition(id)?.name || id);
    const missingNames = missing.map((id) => getSkillDefinition(id)?.name || id);

    results.push({
      roleId,
      roleTitle: roleProfile.title,
      provenance,
      matchScore,
      matchedSkills: matchedNames,
      missingSkills: missingNames,
      rationale: `You possess ${matched.length} of ${required.length} core competencies for this role.`,
      estimatedTransitionWeeks: Math.max(4, Math.round(roleProfile.typicalTimelineWeeks * (1 - matchScore / 100))),
      recommendedNextMilestone: missingNames[0] ? `Master ${missingNames[0]}` : "Begin interview prep",
    });
  }

  // Sort by match score descending, with user-stated goal always at top
  return results.sort((a, b) => {
    if (a.provenance === "USER_STATED") return -1;
    if (b.provenance === "USER_STATED") return 1;
    return b.matchScore - a.matchScore;
  });
}
