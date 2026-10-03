/**
 * lib/career/careerSimulator.ts
 *
 * UBIX Career Simulator & Scenario Planning Engine
 *
 * Models speculative "What If" career trajectories without fabricating facts:
 * - "What if I learn React?"
 * - "What if I target backend engineering?"
 * - "What if I allocate 5 hours/week instead of 10?"
 *
 * Invariant: Every projection is explicitly tagged as a SCENARIO_SIMULATION.
 * Never presents projected timelines as deterministic guarantees.
 */

import { getSkillDefinition, getSkillPrerequisites } from "./skillGraph";

export interface SimulationAssumption {
  weeklyHoursCommitted: number;
  learningVelocityMultiplier: number; // e.g. 1.0 (standard), 1.2 (accelerated with prior CS background)
  targetDomain: string;
  assumedStartingSkills: string[];
}

export interface CareerScenarioProjection {
  scenarioId: string;
  scenarioTitle: string;
  hypothesis: string;
  assumptions: SimulationAssumption;
  identifiedSkillGaps: string[];
  prerequisiteChain: string[];
  estimatedTotalHours: number;
  projectedWeeksToReadiness: number;
  recommendedMilestones: Array<{
    order: number;
    milestone: string;
    focusSkill: string;
    hoursRequired: number;
  }>;
  disclaimer: "SCENARIO_PROJECTION_NOT_A_GUARANTEE";
}

/**
 * Simulates a hypothetical career pivot or skill acquisition scenario.
 */
export function simulateCareerScenario(input: {
  hypothesis: string; // e.g., "What if I learn React and Next.js?"
  targetSkillsToAcquire: string[];
  currentVerifiedSkills: string[];
  weeklyHoursCommitted?: number;
}): CareerScenarioProjection {
  const weeklyHours = input.weeklyHoursCommitted || 8;
  const currentSet = new Set(input.currentVerifiedSkills.map((s) => s.toLowerCase()));

  const identifiedGaps: string[] = [];
  const prerequisitesSet = new Set<string>();

  for (const skill of input.targetSkillsToAcquire) {
    if (!currentSet.has(skill.toLowerCase())) {
      identifiedGaps.push(skill);
      const prereqs = getSkillPrerequisites(skill);
      prereqs.forEach((p) => {
        if (!currentSet.has(p.id.toLowerCase()) && !currentSet.has(p.name.toLowerCase())) {
          prerequisitesSet.add(p.name);
        }
      });
    }
  }

  // Calculate estimated effort: baseline 25 hours per intermediate skill + 15 hours per prerequisite
  const prereqHours = prerequisitesSet.size * 15;
  const directSkillHours = identifiedGaps.length * 25;
  const totalHours = prereqHours + directSkillHours;
  const projectedWeeks = Math.max(1, Math.ceil(totalHours / weeklyHours));

  // Build sequential milestones
  const milestones: CareerScenarioProjection["recommendedMilestones"] = [];
  let order = 1;

  prerequisitesSet.forEach((p) => {
    milestones.push({
      order: order++,
      milestone: `Foundational mastery of prerequisite: ${p}`,
      focusSkill: p,
      hoursRequired: 15,
    });
  });

  identifiedGaps.forEach((g) => {
    milestones.push({
      order: order++,
      milestone: `Deliver production project exhibit demonstrating ${g}`,
      focusSkill: g,
      hoursRequired: 25,
    });
  });

  return {
    scenarioId: `scen_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    scenarioTitle: `Scenario: Acquire ${input.targetSkillsToAcquire.join(" & ")} at ${weeklyHours} hrs/week`,
    hypothesis: input.hypothesis,
    assumptions: {
      weeklyHoursCommitted: weeklyHours,
      learningVelocityMultiplier: 1.0,
      targetDomain: input.targetSkillsToAcquire[0] || "General Engineering",
      assumedStartingSkills: input.currentVerifiedSkills,
    },
    identifiedSkillGaps: identifiedGaps,
    prerequisiteChain: Array.from(prerequisitesSet),
    estimatedTotalHours: totalHours,
    projectedWeeksToReadiness: projectedWeeks,
    recommendedMilestones: milestones,
    disclaimer: "SCENARIO_PROJECTION_NOT_A_GUARANTEE",
  };
}
