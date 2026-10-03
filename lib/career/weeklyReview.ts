/**
 * lib/career/weeklyReview.ts
 *
 * UBIX Weekly Career Review Engine
 *
 * Summarizes verifiable milestones achieved over the preceding 7 days:
 * - Skills added to Evidence Wallet
 * - Practice assessments and Teach-Back evaluations completed
 * - Applications submitted with verified provider receipts
 * - Interviews conducted and performance trajectories
 * - Actionable priorities for the upcoming week
 *
 * STRICT INVARIANT: Only historical events with confirmed timestamps
 * are represented as facts. Recommendations are strictly labeled as proposals.
 */

import { SkillEvidenceItem } from "./evidenceWallet";
import { ApplicationDraft } from "../apply/schemas";
import { InterviewAttemptRecord } from "../interview/interviewMemory";

export interface WeeklyCareerReport {
  periodStartDate: string;
  periodEndDate: string;
  userId: string;
  confirmedFacts: {
    skillsGained: Array<{ skill: string; source: string; confidence: number }>;
    practiceSessionsCompleted: number;
    applicationsSubmitted: Array<{ company: string; role: string; confirmationId?: string }>;
    interviewsCompleted: number;
    averageInterviewScore?: number;
  };
  unresolvedBlockers: string[];
  proposedNextWeekPriorities: Array<{
    priority: number;
    action: string;
    rationale: string;
    estimatedHours: number;
  }>;
  reviewGeneratedAt: string;
}

/**
 * Compiles a weekly factual review for a candidate.
 */
export function compileWeeklyCareerReview(input: {
  userId: string;
  evidenceItems: SkillEvidenceItem[];
  applications: ApplicationDraft[];
  interviewAttempts: InterviewAttemptRecord[];
  activeSkillGaps: string[];
  availableWeeklyHours?: number;
}): WeeklyCareerReport {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Filter factual achievements occurring in the past 7 days
  const recentEvidence = input.evidenceItems.filter((e) => {
    const d = new Date(e.createdAt);
    return d >= sevenDaysAgo && d <= now && e.status === "CONFIRMED";
  });

  const recentApplications = input.applications.filter((a) => {
    if (a.status !== "SUBMITTED" || !a.submittedAt) return false;
    const d = new Date(a.submittedAt);
    return d >= sevenDaysAgo && d <= now;
  });

  const recentInterviews = input.interviewAttempts.filter((i) => {
    const d = new Date(i.timestamp);
    return d >= sevenDaysAgo && d <= now;
  });

  const skillsGained = recentEvidence.map((e) => ({
    skill: e.skillName,
    source: e.source,
    confidence: e.confidence,
  }));

  const appsSubmitted = recentApplications.map((a) => ({
    company: a.company,
    role: a.jobTitle,
    confirmationId: a.providerSubmissionConfirmationId,
  }));

  let avgInterviewScore: number | undefined;
  if (recentInterviews.length > 0) {
    const total = recentInterviews.reduce((acc, i) => acc + i.rubricScore, 0);
    avgInterviewScore = Math.round(total / recentInterviews.length);
  }

  // Detect unresolved blockers
  const blockers: string[] = [];
  if (input.activeSkillGaps.length >= 3 && skillsGained.length === 0) {
    blockers.push(`Multiple persistent skill gaps identified (${input.activeSkillGaps.slice(0, 3).join(", ")}) without recent evidence updates.`);
  }
  if (recentApplications.length === 0 && skillsGained.length >= 2) {
    blockers.push("Strong recent skill gains have not yet been channeled into targeted job applications.");
  }

  // Propose next week's prioritized plan
  const priorities: WeeklyCareerReport["proposedNextWeekPriorities"] = [];
  let priorityOrder = 1;

  if (input.activeSkillGaps.length > 0) {
    priorities.push({
      priority: priorityOrder++,
      action: `Complete 1 project milestone targeting primary skill gap: ${input.activeSkillGaps[0]}`,
      rationale: "Fills the most critical deficit required for target role eligibility.",
      estimatedHours: 4,
    });
  }

  priorities.push({
    priority: priorityOrder++,
    action: "Complete 1 STAR behavioral or technical practice session",
    rationale: "Maintains interview fluency and builds longitudinal confidence scores.",
    estimatedHours: 1,
  });

  if (skillsGained.length > 0) {
    priorities.push({
      priority: priorityOrder++,
      action: "Review suggested resume bullet updates in Automation Center",
      rationale: "Ensures newly verified achievements are accurately reflected in outbound materials.",
      estimatedHours: 1,
    });
  }

  return {
    periodStartDate: sevenDaysAgo.toISOString(),
    periodEndDate: now.toISOString(),
    userId: input.userId,
    confirmedFacts: {
      skillsGained,
      practiceSessionsCompleted: recentEvidence.filter((e) => e.source === "PRACTICE_ASSESSMENT").length,
      applicationsSubmitted: appsSubmitted,
      interviewsCompleted: recentInterviews.length,
      averageInterviewScore: avgInterviewScore,
    },
    unresolvedBlockers: blockers,
    proposedNextWeekPriorities: priorities,
    reviewGeneratedAt: now.toISOString(),
  };
}
