/**
 * lib/ai/orchestrator/authoritativeCareerState.ts
 *
 * UBIX Server-Authoritative Career State Snapshot:
 * Enforces a single authoritative source of truth for all career facts across:
 * Profile -> Resume -> Roadmap -> Practice -> Jobs -> Deadlines.
 *
 * ARCHITECTURAL INVARIANTS:
 * 1. The client browser is NEVER trusted for career facts.
 * 2. If authoritative data does not exist, status is "UNKNOWN" with currentValue: null.
 * 3. Never invent synthetic numbers (e.g. fake ATS scores, fake progress, fake streaks).
 * 4. Never use sentinel strings (__SKIPPED__, __DONT_KNOW__) as values.
 * 5. Every field carries: currentValue, status, confidence, source, updatedAt.
 */

import { supabase } from "@/lib/supabase";
import { AuthoritativeCareerState, CareerSynthesisEngine } from "./careerStateSynthesis";

export type CareerFieldStatus =
  | "KNOWN"
  | "UNKNOWN"
  | "SKIPPED"
  | "AMBIGUOUS"
  | "OUTDATED"
  | "LOW_CONFIDENCE"
  | "CONFIRMED";

export type CareerFieldSource =
  | "database"
  | "deterministic_calculation"
  | "user_explicit"
  | "verified_external"
  | "default";

export interface CareerStateField<T> {
  currentValue: T | null;
  status: CareerFieldStatus;
  confidence: number; // 0.0 - 1.0
  source: CareerFieldSource;
  updatedAt: string | null;
}

export interface CareerRoadmapState {
  activeRole: string;
  currentMilestoneIndex: number;
  totalMilestones: number;
  currentMilestoneTitle: string;
  currentMilestoneConcepts: string[];
  completedMilestoneIndices: number[];
  completionPercentage: number;
}

export interface CareerPracticeState {
  recentScoreAverage: number;
  totalQuestionsAnswered: number;
  currentStreak: number;
  struggledConcepts: string[];
  masteredConcepts: string[];
  latestPracticeDate: string | null;
}

export interface CareerResumeState {
  hasResume: boolean;
  filename: string | null;
  uploadedAt: string | null;
  verifiedSkills: string[];
  missingSkills: string[];
}

export interface CareerJobsState {
  targetRoles: string[];
  matchedCount: number;
  preferredWorkMode: string | null;
}

export interface CareerInterviewState {
  interviewUpcoming: boolean;
  interviewRole: string | null;
  interviewDate: string | null;
  daysRemaining: number | null;
}

export interface CareerStateSnapshot {
  userId: string;
  targetRole: CareerStateField<string>;
  skills: CareerStateField<string[]>;
  missingSkills: CareerStateField<string[]>;
  roadmap: CareerStateField<CareerRoadmapState>;
  learningProgress: CareerStateField<number>;
  practiceHistory: CareerStateField<CareerPracticeState>;
  practiceWeakAreas: CareerStateField<string[]>;
  practiceMasteredAreas: CareerStateField<string[]>;
  resumeState: CareerStateField<CareerResumeState>;
  atsScore: CareerStateField<number>;
  jobsState: CareerStateField<CareerJobsState>;
  interviewState: CareerStateField<CareerInterviewState>;
  milestones: CareerStateField<any[]>;
  lastUpdated: string;
}

/**
 * Creates a clean default unknown field
 */
function createUnknownField<T>(fallbackValue: T | null = null): CareerStateField<T> {
  return {
    currentValue: fallbackValue,
    status: "UNKNOWN",
    confidence: 0,
    source: "default",
    updatedAt: null,
  };
}

/**
 * Creates a verified known field
 */
function createKnownField<T>(
  val: T,
  source: CareerFieldSource = "database",
  confidence = 1.0,
  updatedAt: string | null = new Date().toISOString()
): CareerStateField<T> {
  return {
    currentValue: val,
    status: "KNOWN",
    confidence,
    source,
    updatedAt,
  };
}

/**
 * Creates a clean default baseline snapshot with UNKNOWN statuses
 */
export function createDefaultCareerSnapshot(userId: string): CareerStateSnapshot {
  return {
    userId,
    targetRole: createUnknownField<string>(null),
    skills: createUnknownField<string[]>([]),
    missingSkills: createUnknownField<string[]>([]),
    roadmap: createUnknownField<CareerRoadmapState>({
      activeRole: "",
      currentMilestoneIndex: 0,
      totalMilestones: 0,
      currentMilestoneTitle: "",
      currentMilestoneConcepts: [],
      completedMilestoneIndices: [],
      completionPercentage: 0,
    }),
    learningProgress: createUnknownField<number>(0),
    practiceHistory: createUnknownField<CareerPracticeState>({
      recentScoreAverage: 0,
      totalQuestionsAnswered: 0,
      currentStreak: 0,
      struggledConcepts: [],
      masteredConcepts: [],
      latestPracticeDate: null,
    }),
    practiceWeakAreas: createUnknownField<string[]>([]),
    practiceMasteredAreas: createUnknownField<string[]>([]),
    resumeState: createUnknownField<CareerResumeState>({
      hasResume: false,
      filename: null,
      uploadedAt: null,
      verifiedSkills: [],
      missingSkills: [],
    }),
    atsScore: createUnknownField<number>(null),
    jobsState: createUnknownField<CareerJobsState>({
      targetRoles: [],
      matchedCount: 0,
      preferredWorkMode: null,
    }),
    interviewState: createUnknownField<CareerInterviewState>({
      interviewUpcoming: false,
      interviewRole: null,
      interviewDate: null,
      daysRemaining: null,
    }),
    milestones: createUnknownField<any[]>([]),
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Evaluates whether an inquiry requires authoritative Career State retrieval.
 * General knowledge, definition, and concept queries bypass database retrieval to minimize latency and token overhead.
 */
export function isCareerQuery(text: string, currentPage?: string): boolean {
  if (!text || typeof text !== "string") return false;
  const clean = text.trim();

  // If user is currently viewing/interacting with a career entity or roadmap page
  if (currentPage && ["roadmap", "progress", "journey"].includes(currentPage.toLowerCase())) {
    return true;
  }

  // 1. Explicit career synthesis query types ("what should I work on today?", etc.)
  if (CareerSynthesisEngine.detectQueryType(clean) !== null) {
    return true;
  }

  // 2. Personal career keywords & context
  const careerKeywords = /\b(my (role|career|skills|roadmap|progress|resume|ats|interview|milestone|learning|streak)|what skills am i missing|based on my resume|my weak areas|my job matches|update my|where am i weak|what to study today)\b/i;
  return careerKeywords.test(clean);
}

/**
 * Queries the authoritative PostgreSQL / Supabase tables for a given user.
 * Service-role and direct queries MUST enforce userId ownership explicitly.
 */
export async function getAuthoritativeCareerSnapshot(
  userId: string,
  authEmail?: string
): Promise<CareerStateSnapshot> {
  // Baseline snapshot with UNKNOWN statuses
  const snapshot: CareerStateSnapshot = createDefaultCareerSnapshot(userId);

  if (!userId || !supabase) {
    return snapshot;
  }

  try {
    // 1. Authoritative User Profile & Preference State
    let userRow: any = null;
    const { data: userById } = await supabase
      .from("users")
      .select("id, email, target_role, state, updated_at")
      .eq("id", userId)
      .maybeSingle();

    if (userById) {
      userRow = userById;
    } else if (authEmail) {
      // Fallback matching by verified email bridge
      const { data: userByEmail } = await supabase
        .from("users")
        .select("id, email, target_role, state, updated_at")
        .eq("email", authEmail)
        .maybeSingle();
      if (userByEmail) {
        userRow = userByEmail;
      }
    }

    const effectiveDbUserId = userRow?.id || userId;

    if (userRow?.target_role) {
      snapshot.targetRole = createKnownField<string>(
        userRow.target_role,
        "database",
        1.0,
        userRow.updated_at
      );
      snapshot.jobsState.currentValue!.targetRoles = [userRow.target_role];
    }

    // 2. Authoritative Resume Uploads (Most recent, strictly scoped to user_id)
    const { data: resumes } = await supabase
      .from("resume_uploads")
      .select("id, user_id, filename, ats_score, matched_skills, missing_skills, uploaded_at, target_role")
      .eq("user_id", effectiveDbUserId)
      .order("uploaded_at", { ascending: false })
      .limit(1);

    if (resumes && resumes.length > 0) {
      const latestResume = resumes[0];
      const verifiedSkills = Array.isArray(latestResume.matched_skills) ? latestResume.matched_skills : [];
      const missingSkills = Array.isArray(latestResume.missing_skills) ? latestResume.missing_skills : [];

      snapshot.resumeState = createKnownField<CareerResumeState>(
        {
          hasResume: true,
          filename: latestResume.filename || null,
          uploadedAt: latestResume.uploaded_at || null,
          verifiedSkills,
          missingSkills,
        },
        "database",
        1.0,
        latestResume.uploaded_at
      );

      if (typeof latestResume.ats_score === "number") {
        snapshot.atsScore = createKnownField<number>(
          latestResume.ats_score,
          "database",
          1.0,
          latestResume.uploaded_at
        );
      }

      if (verifiedSkills.length > 0) {
        snapshot.skills = createKnownField<string[]>(
          verifiedSkills,
          "database",
          0.95,
          latestResume.uploaded_at
        );
      }

      if (missingSkills.length > 0) {
        snapshot.missingSkills = createKnownField<string[]>(
          missingSkills,
          "database",
          0.95,
          latestResume.uploaded_at
        );
      }
    }

    // 3. Authoritative Practice History (Strictly scoped to user_id)
    const { data: practiceRows } = await supabase
      .from("practice_history")
      .select("score, struggled_topics, completed_at")
      .eq("user_id", effectiveDbUserId)
      .order("completed_at", { ascending: false })
      .limit(50);

    if (practiceRows && practiceRows.length > 0) {
      const validScores = practiceRows
        .map((r: any) => r.score)
        .filter((s: any): s is number => typeof s === "number");
      const avgScore = validScores.length > 0
        ? Math.round(validScores.reduce((a: number, b: number) => a + b, 0) / validScores.length)
        : 0;

      const struggledSet = new Set<string>();
      for (const r of practiceRows) {
        if (Array.isArray(r.struggled_topics)) {
          r.struggled_topics.forEach((t: string) => struggledSet.add(t));
        }
      }
      const struggledArr = Array.from(struggledSet);

      // Deterministic streak calculation from session dates
      let calculatedStreak = 0;
      if (practiceRows.length > 0 && practiceRows[0].completed_at) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const uniqueDays = Array.from(new Set(practiceRows
          .map((r: any) => r.completed_at ? new Date(r.completed_at).toISOString().split("T")[0] : null)
          .filter((d: any): d is string => Boolean(d))
        )).sort().reverse();

        if (uniqueDays.length > 0) {
          const latestDay = new Date(uniqueDays[0]);
          latestDay.setHours(0, 0, 0, 0);
          const diffDays = Math.round((today.getTime() - latestDay.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays <= 1) {
            calculatedStreak = 1;
            let prevDate = latestDay;
            for (let i = 1; i < uniqueDays.length; i++) {
              const curDate = new Date(uniqueDays[i]);
              curDate.setHours(0, 0, 0, 0);
              const dayStep = Math.round((prevDate.getTime() - curDate.getTime()) / (1000 * 60 * 60 * 24));
              if (dayStep === 1) {
                calculatedStreak++;
                prevDate = curDate;
              } else {
                break;
              }
            }
          }
        }
      }

      const practiceState: CareerPracticeState = {
        recentScoreAverage: avgScore,
        totalQuestionsAnswered: practiceRows.length,
        currentStreak: calculatedStreak,
        struggledConcepts: struggledArr,
        masteredConcepts: avgScore >= 80 && snapshot.skills.currentValue ? snapshot.skills.currentValue : [],
        latestPracticeDate: practiceRows[0].completed_at || null,
      };

      snapshot.practiceHistory = createKnownField<CareerPracticeState>(
        practiceState,
        "database",
        1.0,
        practiceRows[0].completed_at
      );

      if (struggledArr.length > 0) {
        snapshot.practiceWeakAreas = createKnownField<string[]>(
          struggledArr,
          "deterministic_calculation",
          1.0,
          practiceRows[0].completed_at
        );
      }
    }

    // 4. Authoritative Roadmap State (Strictly scoped to user_id)
    const { data: roadmapRows } = await supabase
      .from("roadmaps")
      .select("role_id, title, current_step, progress, milestones, updated_at")
      .eq("user_id", effectiveDbUserId)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (roadmapRows && roadmapRows.length > 0) {
      const rm = roadmapRows[0];
      const milestonesList = Array.isArray(rm.milestones) ? rm.milestones : [];
      const currentIdx = (typeof rm.current_step === "number" ? rm.current_step : 1) - 1;
      const currentMilestone = milestonesList[currentIdx] || milestonesList[0] || {};

      const roadmapState: CareerRoadmapState = {
        activeRole: rm.role_id || snapshot.targetRole.currentValue || "",
        currentMilestoneIndex: Math.max(0, currentIdx),
        totalMilestones: milestonesList.length,
        currentMilestoneTitle: currentMilestone.title || rm.title || "Foundations",
        currentMilestoneConcepts: Array.isArray(currentMilestone.skills) ? currentMilestone.skills : [],
        completedMilestoneIndices: milestonesList
          .map((m: any, idx: number) => (m.completed ? idx : -1))
          .filter((idx: number) => idx >= 0),
        completionPercentage: typeof rm.progress === "number" ? Math.round(rm.progress) : 0,
      };

      snapshot.roadmap = createKnownField<CareerRoadmapState>(
        roadmapState,
        "database",
        1.0,
        rm.updated_at
      );
      snapshot.learningProgress = createKnownField<number>(
        roadmapState.completionPercentage,
        "database",
        1.0,
        rm.updated_at
      );
      snapshot.milestones = createKnownField<any[]>(
        milestonesList,
        "database",
        1.0,
        rm.updated_at
      );
    }
  } catch (err) {
    console.warn(`[Authoritative State] Error querying DB state for user ${userId}:`, err);
  }

  return snapshot;
}

/**
 * Converts a strongly-typed CareerStateSnapshot into the AuthoritativeCareerState format
 * consumed by the deterministic CareerSynthesisEngine.
 *
 * Crucially: Unknown or absent values are represented as undefined/empty arrays/zeros
 * rather than hardcoded synthetic defaults.
 */
export function toAuthoritativeCareerState(
  snapshot: CareerStateSnapshot
): AuthoritativeCareerState {
  const targetRole = snapshot.targetRole.status === "KNOWN" ? snapshot.targetRole.currentValue || undefined : undefined;
  const roadmapVal = snapshot.roadmap.currentValue;
  const practiceVal = snapshot.practiceHistory.currentValue;
  const resumeVal = snapshot.resumeState.currentValue;
  const atsScore = snapshot.atsScore.status === "KNOWN" ? snapshot.atsScore.currentValue ?? undefined : undefined;
  const interviewVal = snapshot.interviewState.currentValue;

  return {
    goal: {
      targetRole,
      experienceLevel: undefined,
      learningHoursPerWeek: undefined,
      location: undefined,
      targetDeadlineDays: undefined,
    },
    roadmap: {
      activeRole: roadmapVal?.activeRole || targetRole,
      currentMilestoneIndex: roadmapVal?.currentMilestoneIndex ?? 0,
      totalMilestones: roadmapVal?.totalMilestones ?? 0,
      currentMilestoneTitle: roadmapVal?.currentMilestoneTitle || "",
      currentMilestoneConcepts: roadmapVal?.currentMilestoneConcepts || [],
      completedMilestoneIndices: roadmapVal?.completedMilestoneIndices || [],
      completionPercentage: roadmapVal?.completionPercentage ?? 0,
    },
    practice: {
      recentScoreAverage: practiceVal?.recentScoreAverage ?? 0,
      totalQuestionsAnswered: practiceVal?.totalQuestionsAnswered ?? 0,
      currentStreak: practiceVal?.currentStreak ?? 0,
      struggledConcepts: practiceVal?.struggledConcepts || [],
      masteredConcepts: practiceVal?.masteredConcepts || [],
      latestPracticeDate: practiceVal?.latestPracticeDate || undefined,
    },
    resume: {
      hasResume: resumeVal?.hasResume ?? false,
      atsScore,
      verifiedSkills: snapshot.skills.currentValue || [],
      missingSkills: snapshot.missingSkills.currentValue || [],
    },
    jobs: {
      targetRoles: targetRole ? [targetRole] : [],
      matchedCount: snapshot.jobsState.currentValue?.matchedCount ?? 0,
      preferredWorkMode: snapshot.jobsState.currentValue?.preferredWorkMode || undefined,
    },
    deadlines: {
      interviewUpcoming: interviewVal?.interviewUpcoming ?? false,
      interviewRole: interviewVal?.interviewRole || undefined,
      daysRemaining: interviewVal?.daysRemaining ?? undefined,
    },
  };
}
