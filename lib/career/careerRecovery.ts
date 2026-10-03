/**
 * lib/career/careerRecovery.ts
 *
 * UBIX Career Recovery Engine
 *
 * Provides a welcoming, non-judgmental restart pathway when candidate learning
 * or roadmap progress has been paused or interrupted.
 *
 * Invariants:
 * - ZERO shaming language, streak guilt, or negative framing.
 * - Highlights already-earned, permanently retained knowledge.
 * - Proposes a low-friction "quick win" restart milestone.
 */

export interface CareerRecoveryPlan {
  status: "READY_TO_RESUME";
  welcomeMessage: string;
  retainedStrengths: string[];
  remainingMilestones: string[];
  quickWinRestartTask: {
    title: string;
    estimatedMinutes: number;
    description: string;
    actionUrl: string;
  };
  recalibratedTimelineWeeks: number;
}

/**
 * Generates an empathetic, actionable recovery plan.
 */
export function generateRecoveryPlan(input: {
  roleTitle: string;
  verifiedSkills: string[];
  pendingSkills: string[];
  daysInactive?: number;
}): CareerRecoveryPlan {
  const verified = input.verifiedSkills.length > 0 ? input.verifiedSkills : ["Foundational problem solving"];
  const pending = input.pendingSkills.length > 0 ? input.pendingSkills : ["Advanced project patterns"];

  const quickWinSkill = pending[0] || "Core Review";

  return {
    status: "READY_TO_RESUME",
    welcomeMessage: `Welcome back! Your verified progress toward ${input.roleTitle} is completely preserved and ready whenever you are.`,
    retainedStrengths: verified,
    remainingMilestones: pending,
    quickWinRestartTask: {
      title: `15-Minute ${quickWinSkill} Quick Refresh`,
      estimatedMinutes: 15,
      description: `A lightweight, interactive overview of ${quickWinSkill} to build momentum effortlessly.`,
      actionUrl: "/practice",
    },
    recalibratedTimelineWeeks: Math.max(2, Math.ceil(pending.length * 1.5)),
  };
}
