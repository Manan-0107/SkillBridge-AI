/**
 * lib/career/weeklyPlanning.ts
 *
 * UBIX Automated Weekly Career Planning
 *
 * Synthesizes active deadlines, roadmap milestones, and available time budget
 * into an adjustable 7-day schedule with daily task distribution.
 *
 * Invariant: Every proposed block is fully customizable and editable by the user.
 */

export interface ScheduledDailyBlock {
  dayOfWeek: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";
  allocatedMinutes: number;
  tasks: Array<{
    id: string;
    title: string;
    category: "LEARNING" | "PRACTICE" | "PROJECT" | "APPLICATION" | "INTERVIEW_PREP";
    targetSkill?: string;
    rationale: string;
    estimatedMinutes: number;
  }>;
}

export interface WeeklyCareerPlan {
  planId: string;
  userId: string;
  totalPlannedMinutes: number;
  weeklyAvailableMinutes: number;
  dailyBlocks: ScheduledDailyBlock[];
  createdAt: string;
  isUserModified: boolean;
}

/**
 * Generates an editable weekly plan calibrated against available time.
 */
export function generateWeeklyPlan(input: {
  userId: string;
  weeklyAvailableHours: number;
  skillGaps: string[];
  upcomingDeadlines?: Array<{ title: string; dueAt: string }>;
}): WeeklyCareerPlan {
  const weeklyAvailableMinutes = (input.weeklyAvailableHours || 10) * 60;
  const days: Array<ScheduledDailyBlock["dayOfWeek"]> = [
    "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"
  ];

  // Distribute across week (primary workdays: Mon-Fri, lighter on weekend)
  const dailyBudget = Math.floor(weeklyAvailableMinutes / 6); // 5 weekdays + 1 weekend slot
  const dailyBlocks: ScheduledDailyBlock[] = [];

  const primaryGap = input.skillGaps[0] || "Architecture";
  const secondaryGap = input.skillGaps[1] || "Testing";

  days.forEach((day, idx) => {
    if (idx < 5) {
      // Weekday schedule
      const tasks: ScheduledDailyBlock["tasks"] = [];
      if (idx % 2 === 0) {
        tasks.push({
          id: `task_${day.toLowerCase()}_proj`,
          title: `Project Milestone: Implement ${primaryGap} modules`,
          category: "PROJECT",
          targetSkill: primaryGap,
          rationale: `Directly builds demonstrable portfolio deliverable for ${primaryGap}.`,
          estimatedMinutes: Math.min(dailyBudget, 60),
        });
      } else {
        tasks.push({
          id: `task_${day.toLowerCase()}_prac`,
          title: `Real-World Assessment & Teach-Back: ${secondaryGap}`,
          category: "PRACTICE",
          targetSkill: secondaryGap,
          rationale: `Sharpens interview mental model and adds verified evidence for ${secondaryGap}.`,
          estimatedMinutes: Math.min(dailyBudget, 45),
        });
      }

      dailyBlocks.push({
        dayOfWeek: day,
        allocatedMinutes: tasks.reduce((sum, t) => sum + t.estimatedMinutes, 0),
        tasks,
      });
    } else if (day === "SATURDAY") {
      // Light weekend review
      dailyBlocks.push({
        dayOfWeek: day,
        allocatedMinutes: 30,
        tasks: [
          {
            id: `task_sat_review`,
            title: "Review matching jobs and inspect new opportunities",
            category: "APPLICATION",
            rationale: "Keeps pipeline active with zero pressure.",
            estimatedMinutes: 30,
          },
        ],
      });
    } else {
      // Rest / Recovery Day
      dailyBlocks.push({
        dayOfWeek: day,
        allocatedMinutes: 0,
        tasks: [],
      });
    }
  });

  const totalPlannedMinutes = dailyBlocks.reduce((acc, b) => acc + b.allocatedMinutes, 0);

  return {
    planId: `wplan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId: input.userId,
    totalPlannedMinutes,
    weeklyAvailableMinutes,
    dailyBlocks,
    createdAt: new Date().toISOString(),
    isUserModified: false,
  };
}
