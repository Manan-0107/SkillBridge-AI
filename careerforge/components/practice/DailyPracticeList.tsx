"use client";

import React, { useState, useEffect, useCallback } from "react";
import { PracticeQuestion, DailyPracticeDocument } from "@/types/practice";
import { QuizAnswerState } from "@/types/storage";
import { getItem, setItem, buildStorageKey } from "@/lib/storage";
import { QuestionCard } from "./QuestionCard";
import { ResultsSummary } from "./ResultsSummary";

interface DailyPracticeListProps {
  documentData: DailyPracticeDocument;
  className?: string;
}

export function DailyPracticeList({
  documentData,
  className = "",
}: DailyPracticeListProps) {
  const { date, track, questions } = documentData;
  const storageKey = buildStorageKey(`practice:${track}`, date);

  // Initialize or load existing quiz state from localStorage
  const [quizState, setQuizState] = useState<QuizAnswerState>(() => {
    return getItem<QuizAnswerState>(storageKey, {
      version: 1,
      date,
      track,
      answers: {},
      isCompleted: false,
      score: 0,
    });
  });

  const [activeTab, setActiveTab] = useState<"quiz" | "summary">(
    quizState.isCompleted ? "summary" : "quiz"
  );

  // Answer submit handler
  const handleAnswerSubmit = useCallback(
    (questionId: string, answer: string, isCorrect: boolean) => {
      setQuizState((prev) => {
        const nextAnswers = {
          ...prev.answers,
          [questionId]: {
            questionId,
            selectedAnswer: answer,
            isCorrect,
            answeredAt: new Date().toISOString(),
          },
        };

        const answeredCount = Object.keys(nextAnswers).length;
        const isNowCompleted = answeredCount === questions.length;

        const correctCount = Object.values(nextAnswers).filter((a) => a.isCorrect).length;
        const nextScore = Math.round((correctCount / questions.length) * 100);

        const nextState: QuizAnswerState = {
          version: 1,
          date,
          track,
          answers: nextAnswers,
          isCompleted: isNowCompleted,
          score: nextScore,
          completedAt: isNowCompleted ? new Date().toISOString() : prev.completedAt,
        };

        // Persist to localStorage synchronously without spinners
        setItem(storageKey, nextState);

        if (isNowCompleted) {
          setActiveTab("summary");
        }

        return nextState;
      });
    },
    [date, track, questions.length, storageKey]
  );

  const answeredCount = Object.keys(quizState.answers).length;
  const isFinished = quizState.isCompleted || answeredCount === questions.length;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Progress & State Navigation Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-hairline bg-charcoal-900">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono uppercase tracking-wider text-charcoal-400">
            Progress:
          </span>
          <span className="text-sm font-bold text-accent-400 font-mono">
            {answeredCount} / {questions.length} Answered
          </span>
          <div className="w-24 h-1.5 rounded-full bg-charcoal-800 overflow-hidden ml-1">
            <div
              className="h-full bg-accent-500 rounded-full transition-all duration-300"
              style={{ width: `${(answeredCount / questions.length) * 100}%` }}
            />
          </div>
        </div>

        {isFinished && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("quiz")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === "quiz"
                  ? "bg-charcoal-800 text-white font-semibold border border-hairline"
                  : "text-charcoal-400 hover:text-white"
              }`}
            >
              Review Mode
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("summary")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === "summary"
                  ? "bg-accent-500 text-charcoal-950 font-semibold"
                  : "text-charcoal-400 hover:text-white"
              }`}
            >
              View Summary
            </button>
          </div>
        )}
      </div>

      {/* View: Results Summary */}
      {isFinished && activeTab === "summary" ? (
        <ResultsSummary
          quizState={quizState}
          questions={questions}
          onReviewClick={() => setActiveTab("quiz")}
        />
      ) : (
        /* View: Question Sequence */
        <div className="space-y-5">
          {questions.map((q, idx) => {
            const userRecord = quizState.answers[q.id];
            return (
              <QuestionCard
                key={q.id}
                question={q}
                questionNumber={idx + 1}
                userAnswer={userRecord?.selectedAnswer}
                isReadOnly={quizState.isCompleted}
                onAnswerSubmit={handleAnswerSubmit}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
