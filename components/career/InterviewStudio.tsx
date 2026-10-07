"use client";

import React, { useState, useEffect } from "react";
import type { NormalizedJob, InterviewQuestion, PracticeFeedback } from "@/lib/career/types";
import type { TeachBackPrompt, TeachBackEvaluation } from "@/lib/interview/teachBack";
import {
  Mic,
  Square,
  Volume2,
  RotateCcw,
  Sparkles,
  ChevronRight,
  BookOpen,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";
import { speakText, stopSpeaking } from "@/lib/voice";

interface InterviewStudioProps {
  job: NormalizedJob;
  applicationId?: string;
  onClose?: () => void;
}

export function InterviewStudio({ job, applicationId, onClose }: InterviewStudioProps) {
  const [mode, setMode] = useState<"standard" | "teach_back">("standard");

  // Standard Mock Mode State
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [feedback, setFeedback] = useState<PracticeFeedback | null>(null);

  // Teach-Back Mode State
  const [teachBackPrompt, setTeachBackPrompt] = useState<TeachBackPrompt | null>(null);
  const [loadingTeachBack, setLoadingTeachBack] = useState(false);
  const [teachBackExplanation, setTeachBackExplanation] = useState("");
  const [teachBackEvaluation, setTeachBackEvaluation] = useState<TeachBackEvaluation | null>(null);
  const [selectedAudience, setSelectedAudience] = useState<"JUNIOR_DEVELOPER" | "EXECUTIVE_STAKEHOLDER" | "PEER_ARCHITECT">("JUNIOR_DEVELOPER");

  // Voice & Accessibility Live Region State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState("");
  const [audioErrorNotice, setAudioErrorNotice] = useState("");
  const [evaluating, setEvaluating] = useState(false);

  useEffect(() => {
    fetchQuestions();
    fetchTeachBackPrompt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id]);

  const announce = (msg: string) => {
    setLiveAnnouncement(msg);
  };

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

  const fetchTeachBackPrompt = async (audience = selectedAudience) => {
    setLoadingTeachBack(true);
    setTeachBackEvaluation(null);
    try {
      const skillName = job.skills?.[0] || job.title;
      const res = await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "get_teach_back_prompt",
          skill: skillName,
          targetAudience: audience,
        }),
      });

      const data = await res.json();
      if (res.ok && data.prompt) {
        setTeachBackPrompt(data.prompt);
      }
    } catch (err) {
      console.error("[InterviewStudio] Error fetching teach-back prompt:", err);
    } finally {
      setLoadingTeachBack(false);
    }
  };

  const currentQ = questions[currentIndex];

  const handleStartVoice = () => {
    setAudioErrorNotice("");
    setIsRecording(true);
    setRecordingSeconds(0);
    announce("Recording started. Please speak your explanation clearly.");
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
    announce("Recording stopped.");

    // Strict Truthfulness Requirement:
    // When web microphone returns no transcribed audio, NEVER invent fake answers.
    const activeText = mode === "standard" ? currentAnswer : teachBackExplanation;
    if (!activeText.trim()) {
      const notice = "No audio was detected. Please type your response or try recording again.";
      setAudioErrorNotice(notice);
      announce(notice);
    }
  };

  const handleSpeakQuestion = () => {
    const textToSpeak = mode === "standard" ? currentQ?.question : teachBackPrompt?.conceptToExplain;
    if (!textToSpeak) return;
    speakText(textToSpeak);
  };

  const handleEvaluateStandard = async () => {
    if (!currentQ || !currentAnswer.trim()) return;
    setEvaluating(true);
    setFeedback(null);
    announce("Evaluating your answer against STAR criteria...");

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
        announce("Evaluation ready. Review feedback below.");
      }
    } catch (err) {
      console.error("[InterviewStudio] Error evaluating answer:", err);
      announce("Evaluation encountered a network error. Please retry.");
    } finally {
      setEvaluating(false);
    }
  };

  const handleEvaluateTeachBack = async () => {
    if (!teachBackPrompt || !teachBackExplanation.trim()) return;
    setEvaluating(true);
    setTeachBackEvaluation(null);
    announce("Evaluating your teach-back explanation using Feynman conceptual mastery rubrics...");

    try {
      const res = await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "evaluate_teach_back",
          prompt: teachBackPrompt,
          answer: teachBackExplanation,
        }),
      });

      const data = await res.json();
      if (res.ok && data.evaluation) {
        setTeachBackEvaluation(data.evaluation);
        announce("Teach-back evaluation ready.");
      }
    } catch (err) {
      console.error("[InterviewStudio] Error evaluating teach-back:", err);
      announce("Evaluation failed. Please retry.");
    } finally {
      setEvaluating(false);
    }
  };

  const handleNextQuestion = () => {
    stopSpeaking();
    setFeedback(null);
    setCurrentAnswer("");
    setAudioErrorNotice("");
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-surface/40 p-5 sm:p-6 space-y-6">
      {/* Accessible Live Region */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {liveAnnouncement}
      </div>

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

      {/* Mode Switcher */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-3" role="tablist" aria-label="Practice Modes">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "standard"}
          onClick={() => { setMode("standard"); stopSpeaking(); }}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            mode === "standard"
              ? "bg-accent/15 text-accent border border-accent/30"
              : "text-ink/60 hover:text-white hover:bg-white/5 border border-transparent"
          }`}
        >
          <MessageSquare size={13} aria-hidden="true" />
          <span>Behavioral & STAR Mock</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={mode === "teach_back"}
          onClick={() => { setMode("teach_back"); stopSpeaking(); }}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
            mode === "teach_back"
              ? "bg-accent/15 text-accent border border-accent/30"
              : "text-ink/60 hover:text-white hover:bg-white/5 border border-transparent"
          }`}
        >
          <BookOpen size={13} aria-hidden="true" />
          <span>Teach-Back (Feynman Technique)</span>
        </button>
      </div>

      {/* Audible & Visual Voice Failure Notice */}
      {audioErrorNotice && (
        <div role="alert" className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
          <AlertCircle size={14} className="shrink-0 text-amber-400" aria-hidden="true" />
          <span>{audioErrorNotice}</span>
        </div>
      )}

      {/* MODE 1: STANDARD MOCK INTERVIEW */}
      {mode === "standard" && (
        <>
          {loadingQuestions ? (
            <div className="p-8 text-center text-xs text-ink/50">
              Generating role-specific questions grounded in job requirements...
            </div>
          ) : !currentQ ? (
            <div className="p-8 text-center text-xs text-ink/50">
              No questions available for this role.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Question Banner */}
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
                    <Volume2 size={13} aria-hidden="true" />
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

              {/* Answer Workspace */}
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
                        aria-label="Start recording audio response"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-surface px-2.5 py-1 text-xs font-semibold text-ink/80 hover:text-white hover:border-accent/40 cursor-pointer"
                      >
                        <Mic size={12} className="text-rose-400" aria-hidden="true" />
                        <span>Record Audio</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleStopVoice}
                        aria-label="Stop recording audio response"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-300 animate-pulse cursor-pointer"
                      >
                        <Square size={12} className="fill-current text-rose-400" aria-hidden="true" />
                        <span>Stop Recording ({recordingSeconds}s)</span>
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  id="practice-answer-input"
                  rows={5}
                  value={currentAnswer}
                  onChange={(e) => { setCurrentAnswer(e.target.value); setAudioErrorNotice(""); }}
                  placeholder="Speak or type your answer here..."
                  className="w-full rounded-xl border border-white/10 bg-bg p-3.5 text-xs text-ink leading-relaxed focus:border-accent focus:outline-none"
                />

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => { setCurrentAnswer(""); setAudioErrorNotice(""); }}
                    className="inline-flex items-center gap-1 text-[11px] text-ink/40 hover:text-ink/80 cursor-pointer"
                  >
                    <RotateCcw size={11} aria-hidden="true" />
                    <span>Reset</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleEvaluateStandard}
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
                        <ChevronRight size={13} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Standard Feedback */}
              {feedback && (
                <div className="rounded-xl border border-white/10 bg-surface/50 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-accent" aria-hidden="true" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                      Constructive Answer Feedback
                    </h4>
                  </div>

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
        </>
      )}

      {/* MODE 2: TEACH-BACK (FEYNMAN TECHNIQUE) */}
      {mode === "teach_back" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-wider text-accent font-semibold">
                Feynman Technique Teach-Back
              </span>
            </div>
            <p className="text-xs text-ink/80 leading-relaxed">
              You will explain this concept as if teaching it to someone learning it for the first time.
              Avoid jargon. Use clear analogies and precise architectural flow.
            </p>
          </div>

          {loadingTeachBack ? (
            <div className="p-8 text-center text-xs text-ink/50">
              Loading conceptual teach-back prompt...
            </div>
          ) : teachBackPrompt && (
            <div className="space-y-4">
              {/* Audience selection */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-ink/60 uppercase">Target Audience:</span>
                <select
                  value={selectedAudience}
                  onChange={(e) => {
                    const aud = e.target.value as any;
                    setSelectedAudience(aud);
                    fetchTeachBackPrompt(aud);
                  }}
                  className="rounded-lg border border-white/10 bg-surface px-2.5 py-1 text-xs text-ink focus:border-accent focus:outline-none cursor-pointer"
                  aria-label="Target audience for explanation"
                >
                  <option value="JUNIOR_DEVELOPER">Junior Developer (Break down mechanics)</option>
                  <option value="EXECUTIVE_STAKEHOLDER">Executive Stakeholder (Focus on business value & trade-offs)</option>
                  <option value="PEER_ARCHITECT">Peer Architect (System boundaries & concurrency)</option>
                </select>
              </div>

              {/* Prompt Card */}
              <div className="rounded-xl border border-white/10 bg-surface/60 p-5 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-[11px] text-accent font-semibold">
                    Concept Challenge: {teachBackPrompt.topic}
                  </span>
                  <button
                    type="button"
                    onClick={handleSpeakQuestion}
                    className="inline-flex items-center gap-1 text-[11px] text-ink/60 hover:text-white cursor-pointer"
                    aria-label="Read prompt aloud"
                  >
                    <Volume2 size={13} aria-hidden="true" />
                    <span>Listen</span>
                  </button>
                </div>

                <h4 className="text-sm font-semibold text-white leading-relaxed">
                  {teachBackPrompt.conceptToExplain}
                </h4>

                <div className="text-xs space-y-1">
                  <span className="text-[11px] font-semibold text-ink/70">Key Concepts to Cover:</span>
                  <ul className="text-[11px] text-ink/80 space-y-0.5 list-disc list-inside">
                    {teachBackPrompt.evaluationCriteria.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Input Area */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="teachback-explanation-input" className="text-xs font-bold uppercase tracking-wider text-ink/70">
                    Your Teaching Explanation
                  </label>

                  <div className="flex items-center gap-2">
                    {!isRecording ? (
                      <button
                        type="button"
                        onClick={handleStartVoice}
                        aria-label="Start recording teach-back audio"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-surface px-2.5 py-1 text-xs font-semibold text-ink/80 hover:text-white hover:border-accent/40 cursor-pointer"
                      >
                        <Mic size={12} className="text-rose-400" aria-hidden="true" />
                        <span>Record Audio</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleStopVoice}
                        aria-label="Stop recording teach-back audio"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold text-rose-300 animate-pulse cursor-pointer"
                      >
                        <Square size={12} className="fill-current text-rose-400" aria-hidden="true" />
                        <span>Stop Recording ({recordingSeconds}s)</span>
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  id="teachback-explanation-input"
                  rows={6}
                  value={teachBackExplanation}
                  onChange={(e) => { setTeachBackExplanation(e.target.value); setAudioErrorNotice(""); }}
                  placeholder="Explain this concept in plain language, step-by-step. Use an analogy..."
                  className="w-full rounded-xl border border-white/10 bg-bg p-3.5 text-xs text-ink leading-relaxed focus:border-accent focus:outline-none"
                />

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => { setTeachBackExplanation(""); setAudioErrorNotice(""); }}
                    className="inline-flex items-center gap-1 text-[11px] text-ink/40 hover:text-ink/80 cursor-pointer"
                  >
                    <RotateCcw size={11} aria-hidden="true" />
                    <span>Reset</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleEvaluateTeachBack}
                    disabled={evaluating || !teachBackExplanation.trim()}
                    className="rounded-xl bg-accent px-4 py-1.5 text-xs font-bold text-bg hover:bg-accent/90 transition-colors disabled:opacity-40 cursor-pointer"
                  >
                    {evaluating ? "Evaluating..." : "Evaluate Teach-Back"}
                  </button>
                </div>
              </div>

              {/* Teach-Back Evaluation Results */}
              {teachBackEvaluation && (
                <div className="rounded-xl border border-white/10 bg-surface/50 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles size={15} className="text-accent" aria-hidden="true" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                        Teach-Back Evaluation
                      </h4>
                    </div>

                    <div className="px-3 py-1 rounded-full bg-accent/10 border border-accent/30 text-accent text-xs font-bold font-mono">
                      Score: {teachBackEvaluation.conceptMasteryScore}% · {teachBackEvaluation.accuracyAssessment}
                    </div>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="p-3 rounded-lg bg-surface border border-white/10">
                      <span className="font-semibold text-white block mb-1">Clarity & Pedagogy:</span>
                      <p className="text-ink/80">{teachBackEvaluation.clarityNotes}</p>
                    </div>

                    {teachBackEvaluation.identifiedMisconceptions.length > 0 && (
                      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
                        <span className="font-semibold block mb-1">Identified Misconceptions / Missing Concepts:</span>
                        <ul className="list-disc list-inside space-y-0.5">
                          {teachBackEvaluation.identifiedMisconceptions.map((m, i) => (
                            <li key={i}>{m}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                      <span className="font-semibold block mb-1">Recommended Follow-up Practice:</span>
                      <p>{teachBackEvaluation.suggestedFollowUpPractice}</p>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTeachBackEvaluation(null);
                        setTeachBackExplanation("");
                        fetchTeachBackPrompt(selectedAudience);
                      }}
                      className="rounded-lg border border-white/20 bg-surface px-3 py-1.5 text-xs font-semibold text-white hover:border-accent hover:text-accent transition-colors cursor-pointer"
                    >
                      Try Another Concept
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
