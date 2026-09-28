import React, { useMemo } from "react";
import { PracticeQuestion } from "@/types/practice";
import { QuizAnswerState } from "@/types/storage";

interface ResultsSummaryProps {
  quizState: QuizAnswerState;
  questions: PracticeQuestion[];
  onReviewClick?: () => void;
  className?: string;
}

export function ResultsSummary({
  quizState,
  questions,
  onReviewClick,
  className = "",
}: ResultsSummaryProps) {
  // Compute metrics entirely client-side
  const metrics = useMemo(() => {
    let totalQuestions = questions.length;
    let correctCount = 0;

    const difficultyStats: Record<
      PracticeQuestion["difficulty"],
      { total: number; correct: number }
    > = {
      easy: { total: 0, correct: 0 },
      medium: { total: 0, correct: 0 },
      hard: { total: 0, correct: 0 },
    };

    const tagStats: Record<string, { total: number; correct: number }> = {};

    questions.forEach((q) => {
      const userRecord = quizState.answers[q.id];
      const isCorrect = userRecord?.isCorrect ?? false;

      if (isCorrect) correctCount++;

      // Difficulty
      difficultyStats[q.difficulty].total++;
      if (isCorrect) difficultyStats[q.difficulty].correct++;

      // Tags
      q.tags.forEach((tag) => {
        if (!tagStats[tag]) tagStats[tag] = { total: 0, correct: 0 };
        tagStats[tag].total++;
        if (isCorrect) tagStats[tag].correct++;
      });
    });

    const scorePercentage =
      totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    return {
      totalQuestions,
      correctCount,
      scorePercentage,
      difficultyStats,
      tagStats,
    };
  }, [quizState, questions]);

  const scoreBadgeColor =
    metrics.scorePercentage >= 80
      ? "text-success border-success/30 bg-success/10"
      : metrics.scorePercentage >= 50
      ? "text-accent border-accent/30 bg-accent/10"
      : "text-danger border-danger/30 bg-danger/10";

  return (
    <div
      className={`rounded-2xl border border-ink/10 bg-surface/50 p-6 sm:p-8 space-y-8 animate-fadeIn ${className}`}
    >
      {/* Top Banner Score */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border-b border-ink/10 pb-6">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-ink/50">
            Daily Practice Summary · {quizState.track.toUpperCase()}
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-ink mt-1">
            Session Completed!
          </h2>
          <p className="text-sm text-ink/60 mt-1">
            You solved {metrics.correctCount} out of {metrics.totalQuestions} questions correctly.
          </p>
        </div>

        <div
          className={`flex flex-col items-center justify-center w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border ${scoreBadgeColor}`}
        >
          <span className="text-3xl font-bold font-mono tracking-tight">
            {metrics.scorePercentage}%
          </span>
          <span className="text-[10px] uppercase font-mono tracking-wider opacity-80">
            Score
          </span>
        </div>
      </div>

      {/* Difficulty Breakdown */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono uppercase tracking-wider text-ink/50">
          Difficulty Breakdown
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(["easy", "medium", "hard"] as const).map((diff) => {
            const stat = metrics.difficultyStats[diff];
            const pct = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0;
            return (
              <div
                key={diff}
                className="p-4 rounded-xl border border-ink/10 bg-bg flex flex-col justify-between gap-2"
              >
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="capitalize text-ink/80 font-medium">{diff}</span>
                  <span className="text-ink/60 font-bold">
                    {stat.correct}/{stat.total} ({pct}%)
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-ink/10 overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Topic Tag Breakdown */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono uppercase tracking-wider text-ink/50">
          Skill / Topic Competencies
        </h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(metrics.tagStats).map(([tag, stat]) => {
            const isFull = stat.correct === stat.total;
            return (
              <div
                key={tag}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono ${
                  isFull
                    ? "bg-success/10 border-success/30 text-success"
                    : "bg-bg border-ink/10 text-ink/70"
                }`}
              >
                <span>#{tag}</span>
                <span className="text-[11px] opacity-75">
                  {stat.correct}/{stat.total}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Controls */}
      <div className="flex items-center justify-between border-t border-ink/10 pt-6">
        <span className="text-xs text-ink/40 font-mono">
          Completed sets are saved locally and viewable in review mode.
        </span>
        {onReviewClick && (
          <button
            type="button"
            onClick={onReviewClick}
            className="px-4 py-2 rounded-xl bg-ink hover:opacity-90 border border-ink/15 text-xs font-semibold text-bg transition-opacity cursor-pointer shadow-xs"
          >
            Review Questions
          </button>
        )}
      </div>
    </div>
  );
}
