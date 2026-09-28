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
    easy: "text-success bg-success/10 border-success/30",
    medium: "text-accent bg-accent/10 border-accent/30",
    hard: "text-danger bg-danger/10 border-danger/30",
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
      className={`rounded-2xl border p-5 sm:p-6 bg-surface/40 transition-all ${
        hasSubmitted
          ? isCorrect
            ? "border-success/40 bg-success/5"
            : "border-danger/40 bg-danger/5"
          : "border-ink/10"
      }`}
    >
      {/* Question Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-accent">
            Q{questionNumber} of 10
          </span>
          <span
            className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-md border font-semibold ${
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
              className="text-[10px] font-mono text-ink/50 bg-bg px-2 py-0.5 rounded border border-ink/8"
            >
              #{tag}
            </span>
          ))}
        </div>
      </div>

      {/* Question Prompt */}
      <h3 className="text-base sm:text-lg font-semibold text-ink leading-snug mb-5">
        {question.question}
      </h3>

      {/* MCQ Options */}
      {question.answerType === "mcq" && question.options && (
        <div className="space-y-2.5">
          {question.options.map((opt, idx) => {
            const isSelected = answeredOption === opt;
            const isTheAnswer = opt.trim().toLowerCase() === question.answer.trim().toLowerCase();

            let optionClasses =
              "border-ink/12 bg-bg hover:bg-surface text-ink/80 hover:text-ink";

            if (hasSubmitted) {
              if (isTheAnswer) {
                optionClasses =
                  "border-success/50 bg-success/15 text-success font-semibold";
              } else if (isSelected && !isTheAnswer) {
                optionClasses =
                  "border-danger/50 bg-danger/15 text-danger line-through";
              } else {
                optionClasses = "border-ink/8 bg-bg/50 text-ink/35 opacity-50";
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
                <span className="font-mono text-xs text-ink/40 mt-0.5 font-bold">
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
            className="w-full h-11 px-4 rounded-xl bg-bg border border-ink/15 text-sm text-ink placeholder:text-ink/40 focus:outline-none focus:border-accent"
          />
          {!hasSubmitted && !isReadOnly && (
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-accent hover:opacity-90 text-white font-semibold text-xs transition-opacity cursor-pointer shadow-xs"
            >
              Submit Answer
            </button>
          )}
        </form>
      )}

      {/* Explanation Reveal */}
      {showExplanation && (
        <div className="mt-5 p-4 rounded-xl bg-bg border border-ink/10 text-xs space-y-1.5 animate-fadeIn">
          <div className="flex items-center gap-1.5 font-bold font-mono">
            {isCorrect ? (
              <span className="text-success font-semibold">✓ Correct</span>
            ) : (
              <span className="text-danger font-semibold">✕ Incorrect</span>
            )}
            <span className="text-ink/50 font-normal ml-2">
              Correct Answer: <strong className="text-ink font-semibold">{question.answer}</strong>
            </span>
          </div>
          <p className="text-ink/75 leading-relaxed pt-1">
            {question.explanation}
          </p>
        </div>
      )}
    </div>
  );
});
