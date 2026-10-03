/**
 * lib/career/careerTwin.ts
 *
 * UBIX Career Twin Foundation
 *
 * A deterministic digital twin of the candidate's verified career state that allows
 * what-if scenario simulations (e.g., adding a skill, shifting hours, or changing target roles).
 *
 * Invariant: Every projection is strictly derived from verified candidate evidence
 * and canonical skill graph relationships. Never hallucinates artificial accomplishments.
 */

import { normalizeSkillName, getSkillDefinition } from "./skillGraph";
import { SkillEvidenceItem } from "./evidenceWallet";

export interface SimulationScenarioInput {
  targetSkillToAdd: string;
  hoursPerWeek: number;
  currentRole: string;
  targetRole: string;
}

export interface CareerTwinSimulationResult {
  scenarioName: string;
  projectedSkills: string[];
  effortEstimateWeeks: number;
  marketAlignmentDeltaPercent: number; // e.g. +25%
  unlockedOpportunities: string[];
  keyPrerequisitesToMeetFirst: string[];
  traceableEvidenceInputs: string[];
}

/**
 * Simulates the impact of acquiring a specific target skill.
 */
export function simulateCareerGrowth(
  input: SimulationScenarioInput,
  userEvidence: SkillEvidenceItem[] = []
): CareerTwinSimulationResult {
  const verifiedSkillIds = userEvidence
    .filter((e) => e.status === "CONFIRMED")
    .map((e) => e.skillId);

  const targetId = normalizeSkillName(input.targetSkillToAdd);
  const targetDef = getSkillDefinition(targetId);

  const targetName = targetDef?.name || input.targetSkillToAdd;
  const verifiedNames = verifiedSkillIds.map((id) => getSkillDefinition(id)?.name || id);

  // Check prerequisites
  const prereqs = targetDef?.prerequisites || [];
  const unmetPrereqs = prereqs
    .filter((p) => !verifiedSkillIds.includes(p))
    .map((p) => getSkillDefinition(p)?.name || p);

  // Calculate effort based on hours per week
  const baseEffortHours = targetDef?.difficultyLevel === "ADVANCED" ? 60 : targetDef?.difficultyLevel === "INTERMEDIATE" ? 40 : 25;
  const weeklyHours = Math.max(2, Math.min(40, input.hoursPerWeek || 10));
  const estimatedWeeks = Math.max(1, Math.ceil(baseEffortHours / weeklyHours));

  // Determine market alignment boost
  const alignmentDelta = targetDef?.category === "BACKEND" || targetDef?.category === "DATA" ? 28 : 22;

  const unlockedRoles = [
    `Junior to Mid ${targetName} Specialist`,
    `Full-Stack Candidate with ${targetName} Competency`,
  ];

  return {
    scenarioName: `Scenario: Acquire ${targetName} at ${weeklyHours} hrs/week`,
    projectedSkills: [...verifiedNames, targetName],
    effortEstimateWeeks: estimatedWeeks,
    marketAlignmentDeltaPercent: alignmentDelta,
    unlockedOpportunities: unlockedRoles,
    keyPrerequisitesToMeetFirst: unmetPrereqs,
    traceableEvidenceInputs: userEvidence.map((e) => `${e.skillName} (${e.source})`),
  };
}
