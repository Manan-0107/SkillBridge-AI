"use client";

import React, { useState } from "react";
import { PracticeQuestion } from "@/types/practice";

interface QuestionCardProps {
  question: PracticeQuestion;
  questionNumber: number;
  userAnswer?: string;
  isReadOnly?: boolean;
  onAnswerSubmit: (questionId: string, answer: string, isCorrect: boolean) => void;
}

export const QuestionCard = React.memo(function QuestionCard({
  question,
  questionNumber,
  userAnswer,
  isReadOnly = false,
  onAnswerSubmit,
}: QuestionCardProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(userAnswer ?? null);
  const [shortAnswerInput, setShortAnswerInput] = useState<string>(userAnswer ?? "");
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(Boolean(userAnswer));
  const [showExplanation, setShowExplanation] = useState<boolean>(Boolean(userAnswer));

  const difficultyColors = {
    easy: "text-emerald-400 bg-emerald-950/60 border-emerald-900/60",
    medium: "text-amber-400 bg-amber-950/60 border-amber-900/60",
    hard: "text-rose-400 bg-rose-950/60 border-rose-900/60",
  };

  const handleMcqSelect = (option: string) => {
    if (isReadOnly || hasSubmitted) return;
    setSelectedOption(option);
    const isCorrect = option.trim().toLowerCase() === question.answer.trim().toLowerCase();
    setHasSubmitted(true);
    setShowExplanation(true);
    onAnswerSubmit(question.id, option, isCorrect);
  };

  const handleShortSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || hasSubmitted || !shortAnswerInput.trim()) return;
    const isCorrect =
      shortAnswerInput.trim().toLowerCase() === question.answer.trim().toLowerCase();
    setHasSubmitted(true);
    setShowExplanation(true);
    onAnswerSubmit(question.id, shortAnswerInput.trim(), isCorrect);
  };

  const answeredOption = userAnswer || selectedOption;
  const isCorrect =
    answeredOption?.trim().toLowerCase() === question.answer.trim().toLowerCase();

  return (
    <div
      className={`rounded-2xl border p-5 sm:p-6 bg-charcoal-900 transition-all ${
        hasSubmitted
          ? isCorrect
            ? "border-emerald-500/40 bg-charcoal-900"
            : "border-rose-500/40 bg-charcoal-900"
          : "border-hairline"
      }`}
    >
      {/* Question Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-accent-400">
            Q{questionNumber} of 10
          </span>
          <span
            className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-md border ${
              difficultyColors[question.difficulty]
            }`}
          >
            {question.difficulty}
          </span>
        </div>

        <div className="flex flex-wrap gap-1">
          {question.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] font-mono text-charcoal-400 bg-charcoal-800/80 px-2 py-0.5 rounded"
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>

      {/* Question Prompt */}
      <h3 className="text-base sm:text-lg font-medium text-charcoal-100 leading-snug mb-5">
        {question.question}
      </h3>

      {/* MCQ Options */}
      {question.answerType === "mcq" && question.options && (
        <div className="space-y-2.5">
          {question.options.map((opt, idx) => {
            const isSelected = answeredOption === opt;
            const isTheAnswer = opt.trim().toLowerCase() === question.answer.trim().toLowerCase();

            let optionClasses =
              "border-hairline bg-charcoal-850 hover:bg-charcoal-800 text-charcoal-200";

            if (hasSubmitted) {
              if (isTheAnswer) {
                optionClasses =
                  "border-emerald-500 bg-emerald-950/40 text-emerald-300 font-semibold";
              } else if (isSelected && !isTheAnswer) {
                optionClasses =
                  "border-rose-500 bg-rose-950/40 text-rose-300 line-through";
              } else {
                optionClasses = "border-hairline-subtle bg-charcoal-900/60 text-charcoal-500 opacity-60";
              }
            }

            return (
              <button
                key={idx}
                type="button"
                disabled={isReadOnly || hasSubmitted}
                onClick={() => handleMcqSelect(opt)}
                className={`w-full text-left p-3.5 sm:p-4 rounded-xl border text-xs sm:text-sm transition-all flex items-start gap-3 cursor-pointer disabled:cursor-default ${optionClasses}`}
              >
                <span className="font-mono text-xs text-charcoal-500 mt-0.5">
                  {String.fromCharCode(65 + idx)}.
                </span>
                <span className="leading-relaxed flex-1">{opt}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Short Answer Input */}
      {question.answerType === "short" && (
        <form onSubmit={handleShortSubmit} className="space-y-3">
          <input
            type="text"
            disabled={isReadOnly || hasSubmitted}
            value={shortAnswerInput}
            onChange={(e) => setShortAnswerInput(e.target.value)}
            placeholder="Type your answer..."
            className="w-full h-11 px-4 rounded-xl bg-charcoal-850 border border-hairline text-sm text-charcoal-100 placeholder-charcoal-500 focus:outline-hidden focus:border-accent-400"
          />
          {!hasSubmitted && !isReadOnly && (
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-accent-500 hover:bg-accent-600 text-charcoal-950 font-semibold text-xs transition-colors"
            >
              Submit Answer
            </button>
          )}
        </form>
      )}

      {/* Explanation Reveal */}
      {showExplanation && (
        <div className="mt-5 p-4 rounded-xl bg-charcoal-850 border border-hairline-subtle text-xs space-y-1.5 animate-in fade-in duration-200">
          <div className="flex items-center gap-1.5 font-bold font-mono">
            {isCorrect ? (
              <span className="text-emerald-400">✓ Correct</span>
            ) : (
              <span className="text-rose-400">✕ Incorrect</span>
            )}
            <span className="text-charcoal-400 font-normal ml-2">
              Correct Answer: <strong className="text-charcoal-200">{question.answer}</strong>
            </span>
          </div>
          <p className="text-charcoal-300 leading-relaxed pt-1">
            {question.explanation}
          </p>
        </div>
      )}
    </div>
  );
});
