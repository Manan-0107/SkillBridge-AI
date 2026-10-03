/**
 * lib/career/dailyActionEngine.ts
 *
 * UBIX "What Should I Do Today?" Engine
 *
 * Energy- and time-aware planning that generates a small, prioritized, explainable
 * action plan for the user's current session.
 *
 * Inputs:
 * - availableMinutes: User-declared time budget (e.g., 20, 45, 60 min).
 * - energyLevel: "low" (reading/review) | "medium" (targeted practice) | "high" (project building).
 * - preferredTaskType: "practical_coding" | "conceptual_reading" | "interview_review" | "application_check".
 *
 * Invariant: Never makes psychological or health inferences; adapts strictly to stated parameters.
 */

export type EnergyLevel = "low" | "medium" | "high";
export type PreferredTaskType =
  | "practical_coding"
  | "conceptual_reading"
  | "interview_review"
  | "application_check";

export interface DailyActionItem {
  id: string;
  order: number;
  durationMinutes: number;
  title: string;
  category: "PRACTICE" | "PROJECT" | "LEARNING" | "JOBS" | "REVIEW";
  rationale: string;
  actionUrl: string;
}

export interface DailyActionPlan {
  totalAllocatedMinutes: number;
  energyLevel: EnergyLevel;
  items: DailyActionItem[];
  summaryMessage: string;
  generatedAt: string;
}

/**
 * Generates an adaptive daily action plan based on user's current context.
 */
export function generateDailyPlan(input: {
  availableMinutes?: number;
  energyLevel?: EnergyLevel;
  preferredTaskType?: PreferredTaskType;
  topSkillGap?: string;
  hasUpcomingInterview?: boolean;
  activeApplicationCount?: number;
}): DailyActionPlan {
  const timeBudget = Math.max(15, Math.min(180, input.availableMinutes || 45));
  const energy = input.energyLevel || "medium";
  const items: DailyActionItem[] = [];

  let remaining = timeBudget;
  let order = 1;

  // Urgent interview preparation takes top priority if scheduled
  if (input.hasUpcomingInterview && remaining >= 20) {
    const interviewTime = Math.min(30, remaining);
    items.push({
      id: "action_interview_prep",
      order: order++,
      durationMinutes: interviewTime,
      title: "Interactive Interview Practice",
      category: "PRACTICE",
      rationale: "You have an interview scheduled soon. Running STAR coaching reinforces your communication.",
      actionUrl: "/practice",
    });
    remaining -= interviewTime;
  }

  // Energy-adapted tasks
  if (energy === "low") {
    // Low energy: reading, reviewing matching jobs, or lightweight flash review
    if (remaining >= 15) {
      items.push({
        id: "action_review_jobs",
        order: order++,
        durationMinutes: 15,
        title: "Review New Qualified Job Matches",
        category: "JOBS",
        rationale: "Low-friction scan of fresh postings matching your verified skills.",
        actionUrl: "/jobs",
      });
      remaining -= 15;
    }
    if (remaining >= 15 && input.topSkillGap) {
      items.push({
        id: "action_read_concept",
        order: order++,
        durationMinutes: remaining,
        title: `Read ${input.topSkillGap} Architectural Overview`,
        category: "LEARNING",
        rationale: "Low-cognitive load review of core documentation and concepts.",
        actionUrl: "/journey",
      });
      remaining = 0;
    }
  } else if (energy === "medium") {
    // Medium energy: targeted practice challenge + skill milestone
    const practiceTime = Math.min(25, remaining);
    if (practiceTime >= 15) {
      items.push({
        id: "action_targeted_challenge",
        order: order++,
        durationMinutes: practiceTime,
        title: input.topSkillGap ? `Targeted ${input.topSkillGap} Practice` : "Technical Skills Practice",
        category: "PRACTICE",
        rationale: "Solidifies understanding with an interactive, immediate-feedback exercise.",
        actionUrl: "/practice",
      });
      remaining -= practiceTime;
    }
    if (remaining >= 15) {
      items.push({
        id: "action_review_roadmap",
        order: order++,
        durationMinutes: remaining,
        title: "Check Next Roadmap Milestone",
        category: "REVIEW",
        rationale: "Review completed learning items and plan your next capstone project.",
        actionUrl: "/roadmap",
      });
      remaining = 0;
    }
  } else {
    // High energy: active coding / project building
    const projectTime = Math.min(45, remaining);
    if (projectTime >= 20) {
      items.push({
        id: "action_build_project",
        order: order++,
        durationMinutes: projectTime,
        title: input.topSkillGap ? `Build ${input.topSkillGap} Artifact` : "Project Milestone Implementation",
        category: "PROJECT",
        rationale: "High-focus implementation that directly generates verifiable portfolio evidence.",
        actionUrl: "/journey",
      });
      remaining -= projectTime;
    }
    if (remaining >= 15) {
      items.push({
        id: "action_challenge_wrap",
        order: order++,
        durationMinutes: remaining,
        title: "Benchmark Assessment Challenge",
        category: "PRACTICE",
        rationale: "Validate your project implementation against technical criteria.",
        actionUrl: "/practice",
      });
      remaining = 0;
    }
  }

  const totalAllocated = items.reduce((acc, curr) => acc + curr.durationMinutes, 0);

  return {
    totalAllocatedMinutes: totalAllocated,
    energyLevel: energy,
    items,
    summaryMessage: `Planned a focused ${totalAllocated}-minute session tailored to ${energy} energy.`,
    generatedAt: new Date().toISOString(),
  };
}
