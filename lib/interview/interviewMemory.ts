/**
 * lib/interview/interviewMemory.ts
 *
 * UBIX Structured Interview Memory
 *
 * Persists and evaluates longitudinal interview performance:
 * - Questions posed and user answers
 * - Objective behavioral (STAR) and technical rubric scores
 * - Identified weak areas and tracked improvements across attempts
 *
 * Invariant: Never retains or exposes unrelated personal information.
 */

export interface InterviewAttemptRecord {
  attemptId: string;
  userId: string;
  interviewType: "TECHNICAL" | "BEHAVIORAL" | "SYSTEM_DESIGN" | "TEACH_BACK";
  targetRole: string;
  question: string;
  userAnswer: string;
  rubricScore: number; // 0 to 100
  evaluatedCriteria: {
    clarity: number;
    technicalAccuracy?: number;
    starStructure?: number; // Situation, Task, Action, Result
    depth: number;
  };
  feedback: string;
  weakAreasIdentified: string[];
  improvementNoted?: string;
  timestamp: string;
}

// In-memory tenant-isolated store: userId -> Map<attemptId, InterviewAttemptRecord>
const interviewStores = new Map<string, Map<string, InterviewAttemptRecord>>();

/**
 * Records a completed interview attempt into structured memory.
 */
export function recordInterviewAttempt(
  record: Omit<InterviewAttemptRecord, "attemptId" | "timestamp">
): InterviewAttemptRecord {
  const attemptId = `int_att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const fullRecord: InterviewAttemptRecord = {
    ...record,
    attemptId,
    timestamp: new Date().toISOString(),
  };

  if (!interviewStores.has(record.userId)) {
    interviewStores.set(record.userId, new Map());
  }

  interviewStores.get(record.userId)!.set(attemptId, fullRecord);
  return fullRecord;
}

/**
 * Retrieves interview attempt history for a specific user and optional role.
 */
export function getInterviewHistory(
  userId: string,
  targetRole?: string
): InterviewAttemptRecord[] {
  const store = interviewStores.get(userId);
  if (!store) return [];

  const all = Array.from(store.values());
  if (targetRole) {
    return all.filter((r) => r.targetRole.toLowerCase() === targetRole.toLowerCase());
  }
  return all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * Computes longitudinal weak areas and tracks score trajectory.
 */
export function analyzeInterviewTrends(userId: string): {
  totalAttempts: number;
  averageScore: number;
  recurrentWeakAreas: string[];
  trajectory: "IMPROVING" | "PLATEAUED" | "NEEDS_FOCUS";
} {
  const history = getInterviewHistory(userId);
  if (history.length === 0) {
    return {
      totalAttempts: 0,
      averageScore: 0,
      recurrentWeakAreas: [],
      trajectory: "NEEDS_FOCUS",
    };
  }

  const totalScore = history.reduce((acc, h) => acc + h.rubricScore, 0);
  const avg = Math.round(totalScore / history.length);

  // Recurrent weak areas
  const weakCount: Record<string, number> = {};
  history.forEach((h) => {
    h.weakAreasIdentified.forEach((w) => {
      weakCount[w] = (weakCount[w] || 0) + 1;
    });
  });

  const recurrentWeakAreas = Object.entries(weakCount)
    .filter(([_, count]) => count >= 2)
    .map(([w]) => w);

  // Trajectory based on first half vs second half
  let trajectory: "IMPROVING" | "PLATEAUED" | "NEEDS_FOCUS" = "PLATEAUED";
  if (history.length >= 4) {
    const half = Math.floor(history.length / 2);
    const older = history.slice(half);
    const newer = history.slice(0, half);
    const oldAvg = older.reduce((a, b) => a + b.rubricScore, 0) / older.length;
    const newAvg = newer.reduce((a, b) => a + b.rubricScore, 0) / newer.length;

    if (newAvg > oldAvg + 5) trajectory = "IMPROVING";
    else if (newAvg < oldAvg - 5) trajectory = "NEEDS_FOCUS";
  }

  return {
    totalAttempts: history.length,
    averageScore: avg,
    recurrentWeakAreas,
    trajectory,
  };
}
