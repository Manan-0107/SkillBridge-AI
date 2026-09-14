"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  DailyPracticePayload,
  DailyPracticeState,
  UserAnswerRecord,
  PracticeStreakStats,
} from "@/types/practiceEngine";

interface DailyPracticeQuizProps {
  payload: DailyPracticePayload;
  practiceState: DailyPracticeState;
  onSaveState: (state: DailyPracticeState) => void;
  streakStats: PracticeStreakStats;
  onStreakUpdate: (score: number) => void;
  accentColor?: string;
}

export const DailyPracticeQuiz: React.FC<DailyPracticeQuizProps> = ({
  payload,
  practiceState,
  onSaveState,
  streakStats,
  onStreakUpdate,
  accentColor = "#F59E0B",
}) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [showHint, setShowHint] = useState<boolean>(false);

  const questions = payload.questions || [];
  const currentQuestion = questions[currentIndex];

  const answers = practiceState.answers || {};
  const currentAnswerRecord: UserAnswerRecord | undefined =
    currentQuestion ? answers[currentQuestion.id] : undefined;

  const answeredCount = Object.keys(answers).length;
  const isAllAnswered = answeredCount === 10;

  // Calculate current score
  const totalScore = Object.values(answers).filter((a) => a.isCorrect).length;

  // Handle option select
  const handleSelectOption = useCallback(
    (optionIndex: number) => {
      if (!currentQuestion || currentAnswerRecord) return; // Already answered

      const isCorrect = optionIndex === currentQuestion.correctOptionIndex;
      const newRecord: UserAnswerRecord = {
        questionId: currentQuestion.id,
        selectedOptionIndex: optionIndex,
        isCorrect,
        answeredAt: new Date().toISOString(),
      };

      const nextAnswers = { ...answers, [currentQuestion.id]: newRecord };
      const nextScore = Object.values(nextAnswers).filter((a) => a.isCorrect).length;
      const isNowComplete = Object.keys(nextAnswers).length === 10;

      const nextState: DailyPracticeState = {
        ...practiceState,
        answers: nextAnswers,
        score: nextScore,
        completed: isNowComplete,
      };

      onSaveState(nextState);

      if (isNowComplete && !practiceState.completed) {
        onStreakUpdate(nextScore);
      }
    },
    [currentQuestion, currentAnswerRecord, answers, practiceState, onSaveState, onStreakUpdate]
  );

  const handleNext = useCallback(() => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowHint(false);
    }
  }, [currentIndex, questions.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setShowHint(false);
    }
  }, [currentIndex]);

  // Keyboard navigation for answering and moving between questions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (currentIndex < 10 && !currentAnswerRecord) {
        if (e.key === "1" || e.key.toLowerCase() === "a") handleSelectOption(0);
        else if (e.key === "2" || e.key.toLowerCase() === "b") handleSelectOption(1);
        else if (e.key === "3" || e.key.toLowerCase() === "c") handleSelectOption(2);
        else if (e.key === "4" || e.key.toLowerCase() === "d") handleSelectOption(3);
      }

      if (e.key === "ArrowRight") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, currentAnswerRecord, handleSelectOption, handleNext, handlePrev]);

  const handleRetake = () => {
    if (window.confirm("Reset and retake today's 10 practice drills?")) {
      const resetState: DailyPracticeState = {
        ...practiceState,
        answers: {},
        completed: false,
        score: 0,
      };
      onSaveState(resetState);
      setCurrentIndex(0);
    }
  };

  if (questions.length === 0) {
    return (
      <div className="py-16 text-center rounded-xl border border-slate-800 bg-[#11141f] p-8 max-w-md mx-auto">
        <p className="text-xs text-slate-400">No practice questions available for this track today.</p>
      </div>
    );
  }

  // ALL 10 QUESTIONS COMPLETED SUMMARY SCREEN
  if (isAllAnswered && currentIndex === 10) {
    const percent = Math.round((totalScore / 10) * 100);
    return (
      <div className="max-w-2xl mx-auto rounded-2xl border border-slate-800/90 bg-[#121520] p-6 sm:p-8 shadow-xl space-y-6">
        {/* Banner */}
        <div className="text-center space-y-2.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-slate-900 border border-slate-800 text-amber-400">
            <span>🔥 Daily Challenge Completed</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Session Scorecard
          </h2>
          <p className="text-xs text-slate-400">
            {payload.trackTitle} · Track Drills for {payload.date}
          </p>

          <div className="inline-flex items-center gap-8 px-6 py-3.5 rounded-xl bg-[#0c0e15] border border-slate-800/90 mt-2 shadow-inner">
            <div className="text-center">
              <span className="text-2xl font-mono font-bold text-emerald-400">
                {totalScore} / 10
              </span>
              <span className="block text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                Correct ({percent}%)
              </span>
            </div>

            <div className="h-8 w-[1px] bg-slate-800" />

            <div className="text-center">
              <span className="text-2xl font-mono font-bold text-amber-400">
                {streakStats.currentStreak} Days
              </span>
              <span className="block text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                Active Streak
              </span>
            </div>
          </div>
        </div>

        {/* Question Review Grid */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
              Drill Breakdown
            </h3>
            <span className="text-[11px] text-slate-500">Click any question to inspect</span>
          </div>

          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {questions.map((q, idx) => {
              const ans = answers[q.id];
              return (
                <div
                  key={q.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                    ans?.isCorrect
                      ? "bg-emerald-950/20 border-emerald-900/40 hover:border-emerald-700/60"
                      : "bg-rose-950/20 border-rose-900/40 hover:border-rose-700/60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        ans?.isCorrect
                          ? "bg-emerald-600/30 text-emerald-300 border border-emerald-500/40"
                          : "bg-rose-600/30 text-rose-300 border border-rose-500/40"
                      }`}
                    >
                      {ans?.isCorrect ? "✓" : "✕"}
                    </span>
                    <div>
                      <p className="text-xs font-medium text-slate-200">
                        {idx + 1}. {q.title}
                      </p>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {q.difficulty} · {q.tags.slice(0, 2).join(", ")}
                      </span>
                    </div>
                  </div>

                  <span className="text-xs text-slate-400 hover:text-white font-mono">
                    Inspect →
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={handleRetake}
            className="px-3.5 py-1.5 rounded-lg bg-[#0d1017] border border-slate-800 hover:bg-slate-800 text-xs font-medium text-slate-300 transition-colors cursor-pointer"
          >
            ↺ Reset Session
          </button>
          <button
            type="button"
            onClick={() => setCurrentIndex(0)}
            className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs transition-colors cursor-pointer"
          >
            Review All 10 Questions
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto rounded-2xl border border-slate-800/90 bg-[#121520] p-5 sm:p-7 shadow-xl space-y-5">
      {/* Top Header & Progress Stepper */}
      <div className="space-y-3 border-b border-slate-800/80 pb-4">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-[#0c0e15] border border-slate-800 font-mono text-amber-400 font-bold text-xs">
              Question {currentIndex + 1} of 10
            </span>
            <span className="text-slate-600">·</span>
            <span className="capitalize text-slate-300 font-mono text-[11px]">
              {currentQuestion.difficulty}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-emerald-400 font-medium">
              Score: {totalScore}/{answeredCount}
            </span>
            {isAllAnswered && (
              <button
                type="button"
                onClick={() => setCurrentIndex(10)}
                className="px-2.5 py-1 rounded bg-slate-800 text-[11px] text-amber-300 hover:bg-slate-700 font-medium"
              >
                View Summary
              </button>
            )}
          </div>
        </div>

        {/* 10 Step Interactive Indicator Chips */}
        <div className="flex items-center justify-between gap-1.5 pt-1">
          {questions.map((q, idx) => {
            const ans = answers[q.id];
            const isCurrent = idx === currentIndex;

            let chipStyle = "bg-[#0d1017] border-slate-800 text-slate-500 hover:border-slate-700";
            if (isCurrent) {
              chipStyle = "bg-amber-400/20 border-amber-400 text-amber-300 ring-1 ring-amber-400/40 font-bold";
            } else if (ans) {
              chipStyle = ans.isCorrect
                ? "bg-emerald-950/40 border-emerald-600/50 text-emerald-300 font-semibold"
                : "bg-rose-950/40 border-rose-600/50 text-rose-300 font-semibold";
            }

            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`flex-1 py-1 rounded text-center text-xs font-mono transition-all border cursor-pointer ${chipStyle}`}
                title={`Drill ${idx + 1}`}
              >
                {ans ? (ans.isCorrect ? "✓" : "✕") : idx + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Question Body */}
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400/90">
              {currentQuestion.title}
            </span>
          </div>
          <h3 className="text-base font-semibold text-slate-100 leading-snug">
            {currentQuestion.question}
          </h3>
        </div>

        {/* Code Snippet (Terminal Treatment) */}
        {currentQuestion.codeSnippet && (
          <div className="rounded-xl bg-[#080b13] border border-slate-800 overflow-hidden shadow-sm">
            {/* Terminal Window Header Bar */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#0e121e] border-b border-slate-800/80">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
              </div>
              <span className="text-[10px] font-mono text-slate-500">code snippet</span>
            </div>
            <div className="p-3.5 font-mono text-xs text-amber-200/90 overflow-x-auto leading-relaxed">
              <pre className="whitespace-pre">{currentQuestion.codeSnippet}</pre>
            </div>
          </div>
        )}

        {/* 4 Interactive Option Buttons */}
        <div className="space-y-2 pt-1">
          {currentQuestion.options.map((opt, optIdx) => {
            const isAnswered = Boolean(currentAnswerRecord);
            const isSelected =
              currentAnswerRecord?.selectedOptionIndex === optIdx;
            const isCorrectOption =
              currentQuestion.correctOptionIndex === optIdx;

            let optionStyle =
              "border-slate-800 bg-[#0d1017] hover:bg-[#141824] hover:border-slate-700 text-slate-200";

            if (isAnswered) {
              if (isCorrectOption) {
                optionStyle =
                  "border-emerald-600/70 bg-emerald-950/30 text-emerald-200 ring-1 ring-emerald-500/40";
              } else if (isSelected && !isCorrectOption) {
                optionStyle =
                  "border-rose-600/70 bg-rose-950/30 text-rose-200 ring-1 ring-rose-500/40";
              } else {
                optionStyle = "border-slate-800/50 bg-[#0a0d14] text-slate-500 opacity-60";
              }
            }

            return (
              <button
                key={optIdx}
                type="button"
                disabled={isAnswered}
                onClick={() => handleSelectOption(optIdx)}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${optionStyle}`}
              >
                <span className="h-5 w-5 rounded bg-slate-800/90 border border-slate-700/60 flex items-center justify-center shrink-0 font-mono text-[11px] font-bold text-slate-400 mt-0.5">
                  {String.fromCharCode(65 + optIdx)}
                </span>
                <span className="text-xs sm:text-sm font-medium flex-1">
                  {opt}
                </span>
                {isAnswered && isCorrectOption && (
                  <span className="text-emerald-400 font-bold text-sm">✓</span>
                )}
                {isAnswered && isSelected && !isCorrectOption && (
                  <span className="text-rose-400 font-bold text-sm">✕</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Hint Toggle */}
        {currentQuestion.hints && currentQuestion.hints.length > 0 && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowHint(!showHint)}
              className="text-[11px] text-amber-400/80 hover:text-amber-300 font-medium cursor-pointer flex items-center gap-1"
            >
              <span>💡</span>
              <span>{showHint ? "Hide hint" : "Show conceptual hint"}</span>
            </button>
            {showHint && (
              <div className="mt-2 p-2.5 rounded-lg bg-amber-950/20 border border-amber-800/30 text-xs text-amber-300 leading-relaxed">
                {currentQuestion.hints[0]}
              </div>
            )}
          </div>
        )}

        {/* Pre-Rendered Explanation Card */}
        {currentAnswerRecord && (
          <div className="p-4 rounded-xl bg-[#090c14] border border-slate-800 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-200">
                {currentAnswerRecord.isCorrect ? "✓ Correct Answer" : "Explanation & Core Takeaway"}
              </span>
              <span className="text-[11px] text-slate-500 font-mono">· Architectural Drill Insight</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {currentQuestion.explanation}
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {currentQuestion.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded bg-slate-800/80 text-[10px] font-mono text-slate-400 border border-slate-700/40"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Navigation Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-800">
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
            currentIndex === 0
              ? "text-slate-600 bg-slate-900/60 cursor-not-allowed border border-transparent"
              : "text-slate-300 bg-[#0d1017] border border-slate-800 hover:bg-slate-800 cursor-pointer"
          }`}
        >
          ← Previous
        </button>

        <div className="hidden sm:flex items-center gap-1 text-[10px] text-slate-500 font-mono">
          <span>Keys:</span>
          <kbd className="px-1 bg-slate-800 rounded border border-slate-700">A-D</kbd>
          <span>or</span>
          <kbd className="px-1 bg-slate-800 rounded border border-slate-700">1-4</kbd>
        </div>

        {currentIndex < questions.length - 1 ? (
          <button
            type="button"
            onClick={handleNext}
            className="px-4 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs transition-colors cursor-pointer"
          >
            Next Drill →
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCurrentIndex(10)}
            className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs transition-colors cursor-pointer"
          >
            Review Scorecard →
          </button>
        )}
      </div>
    </div>
  );
};

