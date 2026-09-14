/**
 * Resilient localStorage manager for zero-runtime-DB state persistence.
 * Handles corrupted JSON, quota exceptions, and private browsing restrictions safely.
 */

import {
  TrackId,
  DailyPracticeState,
  PracticeStreakStats,
  UserRoadmapProgress,
  NodeStatus,
} from "@/types/practiceEngine";

const STREAK_KEY = "careerforge_streak_stats";

export const defaultStreakStats: PracticeStreakStats = {
  currentStreak: 0,
  bestStreak: 0,
  lastActiveDate: null,
  totalCompletedDays: 0,
  totalQuestionsAnswered: 0,
  totalCorrect: 0,
};

// ─── DAILY PRACTICE LOCAL STATE ──────────────────────────────────────────────

export function loadDailyPracticeState(
  track: TrackId,
  dateStr: string
): DailyPracticeState {
  const key = `careerforge_practice_${track}_${dateStr}`;
  try {
    if (typeof window === "undefined") {
      return { date: dateStr, track, answers: {}, completed: false, score: 0, timeSpentSeconds: 0 };
    }
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.answers === "object") {
        return parsed as DailyPracticeState;
      }
    }
  } catch (err) {
    console.warn(`[Storage] Failed to read ${key}:`, err);
  }
  return { date: dateStr, track, answers: {}, completed: false, score: 0, timeSpentSeconds: 0 };
}

export function saveDailyPracticeState(state: DailyPracticeState): void {
  const key = `careerforge_practice_${state.track}_${state.date}`;
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(key, JSON.stringify(state));
    }
  } catch (err) {
    console.warn(`[Storage] Failed to save ${key}:`, err);
  }
}

// ─── STREAK STATS LOCAL STATE ────────────────────────────────────────────────

export function loadStreakStats(): PracticeStreakStats {
  try {
    if (typeof window === "undefined") return defaultStreakStats;
    const raw = window.localStorage.getItem(STREAK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...defaultStreakStats,
        ...parsed,
      };
    }
  } catch {
    // fallback
  }
  return defaultStreakStats;
}

export function recordDayCompleted(
  dateStr: string,
  sessionScore: number,
  questionCount: number
): PracticeStreakStats {
  const current = loadStreakStats();
  const lastDate = current.lastActiveDate;

  let newStreak = current.currentStreak;
  if (!lastDate) {
    newStreak = 1;
  } else if (lastDate === dateStr) {
    // Already counted today
  } else {
    const prevDay = new Date(dateStr);
    prevDay.setDate(prevDay.getDate() - 1);
    const prevDayStr = prevDay.toISOString().slice(0, 10);

    if (lastDate === prevDayStr) {
      newStreak += 1;
    } else {
      newStreak = 1; // Streak broken, restart
    }
  }

  const updated: PracticeStreakStats = {
    currentStreak: newStreak,
    bestStreak: Math.max(current.bestStreak, newStreak),
    lastActiveDate: dateStr,
    totalCompletedDays:
      lastDate === dateStr
        ? current.totalCompletedDays
        : current.totalCompletedDays + 1,
    totalQuestionsAnswered: current.totalQuestionsAnswered + questionCount,
    totalCorrect: current.totalCorrect + sessionScore,
  };

  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STREAK_KEY, JSON.stringify(updated));
    }
  } catch {
    // ignore
  }

  return updated;
}

// ─── ROADMAP PROGRESS LOCAL STATE ────────────────────────────────────────────

export function loadRoadmapProgress(track: TrackId): UserRoadmapProgress {
  const key = `careerforge_roadmap_prog_${track}`;
  try {
    if (typeof window === "undefined") {
      return {
        track,
        nodeStatuses: {},
        checklistStates: {},
        selectedNodeId: null,
        lastUpdated: new Date().toISOString(),
      };
    }
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.nodeStatuses === "object") {
        return parsed as UserRoadmapProgress;
      }
    }
  } catch (err) {
    console.warn(`[Storage] Failed to read ${key}:`, err);
  }
  return {
    track,
    nodeStatuses: {},
    checklistStates: {},
    selectedNodeId: null,
    lastUpdated: new Date().toISOString(),
  };
}

export function saveRoadmapProgress(progress: UserRoadmapProgress): void {
  const key = `careerforge_roadmap_prog_${progress.track}`;
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(key, JSON.stringify(progress));
    }
  } catch (err) {
    console.warn(`[Storage] Failed to save ${key}:`, err);
  }
}
