"use client";

import React, { useState, useEffect } from "react";
import type {
  InterviewQuestion,
  PracticeFeedback,
  NormalizedJob,
  ApplicationRecord,
} from "@/lib/career/types";
import {
  Mic,
  Square,
  Play,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  ChevronRight,
  RotateCcw,
  Volume2,
} from "lucide-react";
import { speakText, stopSpeaking } from "@/lib/voice";

interface InterviewStudioProps {
  job: NormalizedJob;
  applicationId?: string;
  onClose?: () => void;
}

export function InterviewStudio({ job, applicationId, onClose }: InterviewStudioProps) {
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [feedback, setFeedback] = useState<PracticeFeedback | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id]);

  const fetchQuestions = async () => {
    setLoadingQuestions(true);
    try {
      const res = await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_questions",
          job,
        }),
      });

      const data = await res.json();
      if (res.ok && Array.isArray(data.questions)) {
        setQuestions(data.questions);
      }
    } catch (err) {
      console.error("[InterviewStudio] Error fetching questions:", err);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const currentQ = questions[currentIndex];

  const handleStartVoice = () => {
    setIsRecording(true);
    setRecordingSeconds(0);
    const interval = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
    setTimerInterval(interval);
  };

  const handleStopVoice = () => {
    setIsRecording(false);
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
    // Simulation / fallback for voice transcript in web browser
    if (!currentAnswer.trim()) {
      setCurrentAnswer(
        "In my previous project, I was responsible for designing our microservices architecture using Node.js and PostgreSQL. We faced a significant bottleneck with high-volume telemetry events. I investigated the issue and implemented Redis caching and stream buffering. As a result, query latency stabilized under peak load."
      );
    }
  };

  const handleSpeakQuestion = () => {
    if (!currentQ) return;
    speakText(currentQ.question);
  };

  const handleEvaluate = async () => {
    if (!currentQ || !currentAnswer.trim()) return;
    setEvaluating(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "evaluate_answer",
          question: currentQ,
          answer: currentAnswer,
        }),
      });

      const data = await res.json();
      if (res.ok && data.feedback) {
        setFeedback(data.feedback);
      }
    } catch (err) {
      console.error("[InterviewStudio] Error evaluating answer:", err);
    } finally {
      setEvaluating(false);
    }
  };

  const handleNextQuestion = () => {
    stopSpeaking();
    setFeedback(null);
    setCurrentAnswer("");
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-surface/40 p-5 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-accent font-semibold">
            Interview Studio
          </span>
          <h3 className="text-base sm:text-lg font-bold text-white mt-0.5">
            Role-Specific Mock Practice for {job.title}
          </h3>
          <p className="text-xs text-ink/60">{job.company}</p>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-ink/50 hover:text-white transition-colors cursor-pointer"
          >
            ✕ Exit Studio
          </button>
        )}
      </div>

      {loadingQuestions ? (
        <div className="p-8 text-center text-xs text-ink/50">
          Generating role-specific questions grounded in job requirements...
        </div>
      ) : !currentQ ? (
        <div className="p-8 text-center text-xs text-ink/50">
          No questions available.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Question Banner & Navigation */}
          <div className="rounded-xl border border-white/10 bg-surface/60 p-5 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-[11px] text-accent font-semibold">
                Question {currentIndex + 1} of {questions.length} ({currentQ.category})
              </span>
              <button
                type="button"
                onClick={handleSpeakQuestion}
                className="inline-flex items-center gap-1 text-[11px] text-ink/60 hover:text-white cursor-pointer"
                aria-label="Read question aloud"
              >
                <Volume2 size={13} />
                <span>Listen</span>
              </button>
            </div>

            <p className="text-sm font-semibold text-white leading-relaxed">
              {currentQ.question}
            </p>

            {currentQ.contextOrRationale && (
              <p className="text-[11px] text-ink/50 italic">
                Context: {currentQ.contextOrRationale}
              </p>
            )}

            {/* STAR Coaching Hint Box */}
            {currentQ.starCoachingTips && (
              <div className="rounded-lg border border-accent/20 bg-accent/5 p-3 text-xs space-y-1.5">
                <span className="font-bold text-accent text-[11px] uppercase tracking-wider block">
                  STAR Coaching Hints
                </span>
                <ul className="text-[11px] text-ink/80 space-y-1 list-disc list-inside">
                  <li><strong>Situation:</strong> {currentQ.starCoachingTips.situationHint}</li>
                  <li><strong>Action:</strong> {currentQ.starCoachingTips.actionHint}</li>
                  <li><strong>Result:</strong> {currentQ.starCoachingTips.resultHint}</li>
                </ul>
              </div>
            )}
          </div>

          {/* Answer Workspace (Voice + Text) */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="practice-answer-input" className="text-xs font-bold uppercase tracking-wider text-ink/70">
                Your Answer
              </label>

              <div className="flex items-center gap-2">
                {!isRecording ? (
                  <button
                    type="button"
                    onClick={handleStartVoice}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-surface px-2.5 py-1 text-xs font-semibold text-ink/80 hover:text-white hover:border-accent/40 cursor-pointer"
                  >
                    <Mic size={12} className="text-rose-400" />
                    <span>Record Audio</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStopVoice}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-300 animate-pulse cursor-pointer"
                  >
                    <Square size={12} className="fill-current text-rose-400" />
                    <span>Stop Recording ({recordingSeconds}s)</span>
                  </button>
                )}
              </div>
            </div>

            <textarea
              id="practice-answer-input"
              rows={5}
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              placeholder="Speak or type your answer here..."
              className="w-full rounded-xl border border-white/10 bg-bg p-3.5 text-xs text-ink leading-relaxed focus:border-accent focus:outline-none"
            />

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setCurrentAnswer("")}
                className="inline-flex items-center gap-1 text-[11px] text-ink/40 hover:text-ink/80 cursor-pointer"
              >
                <RotateCcw size={11} />
                <span>Reset</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleEvaluate}
                  disabled={evaluating || !currentAnswer.trim()}
                  className="rounded-xl bg-accent px-4 py-1.5 text-xs font-bold text-bg hover:bg-accent/90 transition-colors disabled:opacity-40 cursor-pointer"
                >
                  {evaluating ? "Evaluating..." : "Evaluate Answer"}
                </button>

                {currentIndex < questions.length - 1 && (
                  <button
                    type="button"
                    onClick={handleNextQuestion}
                    className="inline-flex items-center gap-1 rounded-xl bg-surface border border-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:border-white/20 transition-colors cursor-pointer"
                  >
                    <span>Next</span>
                    <ChevronRight size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Feedback Card */}
          {feedback && (
            <div className="rounded-xl border border-white/10 bg-surface/50 p-4 space-y-3 animate-fadeIn">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-accent" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                  Constructive Answer Feedback
                </h4>
              </div>

              {/* STAR Breakdown check */}
              {feedback.starBreakdown && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                  <div className={`p-2 rounded-lg border ${feedback.starBreakdown.situationPresent ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-white/5 border-white/5 text-ink/40"}`}>
                    Situation: {feedback.starBreakdown.situationPresent ? "Identified" : "Omitted"}
                  </div>
                  <div className={`p-2 rounded-lg border ${feedback.starBreakdown.taskPresent ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-white/5 border-white/5 text-ink/40"}`}>
                    Task: {feedback.starBreakdown.taskPresent ? "Identified" : "Omitted"}
                  </div>
                  <div className={`p-2 rounded-lg border ${feedback.starBreakdown.actionPresent ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-white/5 border-white/5 text-ink/40"}`}>
                    Action: {feedback.starBreakdown.actionPresent ? "Identified" : "Omitted"}
                  </div>
                  <div className={`p-2 rounded-lg border ${feedback.starBreakdown.resultPresent ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-white/5 border-white/5 text-ink/40"}`}>
                    Result: {feedback.starBreakdown.resultPresent ? "Identified" : "Omitted"}
                  </div>
                </div>
              )}

              {/* Strengths & Improvements */}
              <div className="space-y-2 text-xs">
                {feedback.strengths.length > 0 && (
                  <div className="text-emerald-400 bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-500/20">
                    <span className="font-semibold">Strengths: </span>
                    {feedback.strengths.join(" ")}
                  </div>
                )}
                {feedback.improvements.length > 0 && (
                  <div className="text-amber-300 bg-amber-950/20 p-2.5 rounded-lg border border-amber-500/20">
                    <span className="font-semibold">To Improve: </span>
                    {feedback.improvements.join(" ")}
                  </div>
                )}
              </div>

              <p className="text-xs text-ink/80 italic pt-1">
                {feedback.overallGuidance}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
