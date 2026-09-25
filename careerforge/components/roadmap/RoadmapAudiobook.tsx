"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { RoadmapStep, RoleId } from "@/lib/types";
import {
  speakText,
  stopSpeaking,
  pauseSpeaking,
  resumeSpeaking,
  isSpeaking,
  detectTextLanguage,
  SUPPORTED_LANGUAGES,
  playAccessibleChime,
} from "@/lib/voice";

interface RoadmapAudiobookProps {
  role: RoleId;
  roleLabel: string;
  steps: RoadmapStep[];
  stepResources?: Record<number, {
    blogs: { title: string; source: string; url: string; timeToRead: string }[];
    book: { title: string; author: string; summary: string; url: string };
    youtube: { title: string; channel: string; url: string; duration: string }[];
    udemy: { title: string; rating: number; level: string; url: string };
    coursera: { title: string; rating: number; certBy: string; url: string };
  }>;
  selectedStepIndex: number;
  onSelectStep: (index: number) => void;
}

export function RoadmapAudiobook({
  roleLabel,
  steps,
  stepResources,
  selectedStepIndex,
  onSelectStep,
}: RoadmapAudiobookProps) {
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [currentNarratingIndex, setCurrentNarratingIndex] = useState<number>(selectedStepIndex);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [continuousMode, setContinuousMode] = useState<boolean>(true);
  const [selectedLang, setSelectedLang] = useState<string>("en-US");
  const [expanded, setExpanded] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<string>("");

  const playingRef = useRef(false);
  const currentStepRef = useRef(selectedStepIndex);

  // Keep refs synced
  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  useEffect(() => {
    currentStepRef.current = currentNarratingIndex;
  }, [currentNarratingIndex]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  // ─── Build Rich Audiobook Script for a Stage ─────────────────────────────────
  const generateStageNarration = useCallback(
    (index: number): string => {
      const step = steps[index];
      if (!step) return "";

      const resource = stepResources?.[index];
      const isFirst = index === 0;
      const isLast = index === steps.length - 1;

      let script = "";

      if (isFirst) {
        script += `Welcome to the Career Roadmap Audiobook for ${roleLabel}. `;
      }

      script += `Stage ${index + 1} of ${steps.length}: ${step.title}. `;
      script += `${step.detail}. `;

      if (step.skills && step.skills.length > 0) {
        script += `Key core competencies and skills to master include: ${step.skills.join(", ")}. `;
      }

      if (resource?.book) {
        script += `Authoritative recommended book: ${resource.book.title}, authored by ${resource.book.author}. ${resource.book.summary} `;
      }

      if (resource?.blogs && resource.blogs.length > 0) {
        const blogTitles = resource.blogs.map((b) => b.title).slice(0, 2).join(", and ");
        script += `Recommended technical deep-dive guides include: ${blogTitles}. `;
      }

      if (resource?.coursera) {
        script += `Certified learning path: ${resource.coursera.title}, certified by ${resource.coursera.certBy}. `;
      }

      if (isLast) {
        script += `Congratulations! You have completed all milestones for the ${roleLabel} roadmap. You are ready to accelerate your career!`;
      } else {
        script += `End of Stage ${index + 1}. `;
      }

      return script;
    },
    [steps, stepResources, roleLabel]
  );

  // ─── Play Stage Audio ────────────────────────────────────────────────────────
  const narrateStage = useCallback(
    (index: number) => {
      if (index < 0 || index >= steps.length) {
        setPlaying(false);
        setPaused(false);
        stopSpeaking();
        setStatusMessage("Roadmap audiobook completed.");
        return;
      }

      setCurrentNarratingIndex(index);
      onSelectStep(index);
      setPlaying(true);
      setPaused(false);
      setStatusMessage(`Narrating Stage ${index + 1}: ${steps[index]?.title}`);
      playAccessibleChime("navigate");

      const script = generateStageNarration(index);
      const targetLang = selectedLang || detectTextLanguage(script);

      speakText(script, {
        lang: targetLang,
        rate: playbackSpeed,
        onStart: () => {
          setPlaying(true);
          setPaused(false);
        },
        onEnd: () => {
          if (playingRef.current && continuousMode && index + 1 < steps.length) {
            // Automatically proceed to next milestone after brief pause
            setTimeout(() => {
              narrateStage(index + 1);
            }, 800);
          } else {
            setPlaying(false);
            setPaused(false);
            setStatusMessage(`Finished Stage ${index + 1}`);
          }
        },
        onError: (err) => {
          console.warn("[RoadmapAudiobook] Speech error:", err);
          setPlaying(false);
          setPaused(false);
        },
      });
    },
    [steps, onSelectStep, generateStageNarration, selectedLang, playbackSpeed, continuousMode]
  );

  // ─── Player Controls ────────────────────────────────────────────────────────
  const handlePlayToggle = useCallback(() => {
    if (playing) {
      if (paused) {
        resumeSpeaking();
        setPaused(false);
        setStatusMessage(`Resumed Stage ${currentNarratingIndex + 1}`);
      } else {
        pauseSpeaking();
        setPaused(true);
        setStatusMessage("Paused");
      }
    } else {
      narrateStage(selectedStepIndex);
    }
  }, [playing, paused, currentNarratingIndex, narrateStage, selectedStepIndex]);

  const handleStop = useCallback(() => {
    stopSpeaking();
    setPlaying(false);
    setPaused(false);
    playAccessibleChime("stop");
    setStatusMessage("Audiobook stopped");
  }, []);

  const handleNextStage = useCallback(() => {
    stopSpeaking();
    const nextIdx = Math.min(steps.length - 1, currentNarratingIndex + 1);
    narrateStage(nextIdx);
  }, [steps.length, currentNarratingIndex, narrateStage]);

  const handlePrevStage = useCallback(() => {
    stopSpeaking();
    const prevIdx = Math.max(0, currentNarratingIndex - 1);
    narrateStage(prevIdx);
  }, [currentNarratingIndex, narrateStage]);

  const handleExplainAuthor = useCallback(() => {
    stopSpeaking();
    setPlaying(true);
    setPaused(false);
    const step = steps[currentNarratingIndex];
    if (!step) return;
    const explanation = `Here is what the author means for Stage ${currentNarratingIndex + 1}, ${step.title}: ${step.detail}. In professional production environments, mastering this milestone bridges the gap between foundational theory and practical execution by focusing on ${step.skills && step.skills.length > 0 ? step.skills.join(", ") : "core competencies"}.`;
    setStatusMessage(`Explaining Stage ${currentNarratingIndex + 1}`);
    speakText(explanation, {
      lang: selectedLang || "en-US",
      rate: playbackSpeed,
      onEnd: () => {
        setStatusMessage(`Explanation complete for Stage ${currentNarratingIndex + 1}`);
        setPlaying(false);
      },
      onError: () => setPlaying(false),
    });
  }, [currentNarratingIndex, steps, selectedLang, playbackSpeed]);

  // ─── Immediate Voice Command Listener (Section 7) ───────────────────────────
  useEffect(() => {
    const handleAudiobookEvent = (e: Event) => {
      const custom = e as CustomEvent<{ action: "stop" | "pause" | "resume" | "back" | "forward" | "explain" }>;
      if (!custom.detail?.action) return;
      const { action } = custom.detail;

      if (action === "stop") {
        handleStop();
      } else if (action === "pause") {
        pauseSpeaking();
        setPaused(true);
        setStatusMessage("Paused via voice command");
      } else if (action === "resume") {
        resumeSpeaking();
        setPaused(false);
        setStatusMessage("Resumed via voice command");
      } else if (action === "back") {
        handlePrevStage();
      } else if (action === "forward") {
        handleNextStage();
      } else if (action === "explain") {
        handleExplainAuthor();
      }
    };

    window.addEventListener("careerforge:audiobook-control", handleAudiobookEvent);
    return () => window.removeEventListener("careerforge:audiobook-control", handleAudiobookEvent);
  }, [handleStop, handlePrevStage, handleNextStage, handleExplainAuthor]);

  const changeSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    if (playing && !paused) {
      narrateStage(currentNarratingIndex);
    }
  };

  return (
    <section
      role="region"
      aria-label="Career Roadmap Audiobook Player for Visually Impaired and Blind Users"
      className="mb-8 rounded-2xl border border-ink/15 bg-surface p-5 sm:p-6 text-ink shadow-xs"
    >
      {/* Top Bar / Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-bg border border-ink/15 text-accent shadow-xs">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-bg px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent border border-accent/25">
                Audiobook Mode
              </span>
              <span className="text-xs text-ink/30">•</span>
              <span className="text-xs text-ink/70 font-medium">
                {steps.length} Milestones
              </span>
            </div>
            <h3 className="text-base font-bold tracking-tight text-ink sm:text-lg">
              Listen to Your Career Roadmap
            </h3>
          </div>
        </div>

        {/* Expand / Minimize Toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="rounded-xl border border-ink/15 bg-bg px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface hover:text-accent transition-colors cursor-pointer"
          >
            {expanded ? "Collapse Player" : "Expand Player"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-5 space-y-5">
          {/* Active Stage Narration Card */}
          <div className="rounded-xl border border-ink/15 bg-bg p-4 shadow-xs">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-xs font-bold text-accent uppercase tracking-wider">
                Now Playing: Milestone {currentNarratingIndex + 1} of {steps.length}
              </span>
              {playing && !paused && (
                <div className="flex items-center gap-1 h-3">
                  <span className="h-2 w-1 rounded-full bg-accent animate-pulse" />
                  <span className="h-3.5 w-1 rounded-full bg-accent animate-pulse delay-75" />
                  <span className="h-2.5 w-1 rounded-full bg-accent animate-pulse delay-150" />
                  <span className="h-1.5 w-1 rounded-full bg-accent animate-pulse" />
                </div>
              )}
            </div>

            <h4 className="text-base sm:text-lg font-bold text-ink">
              {steps[currentNarratingIndex]?.title}
            </h4>
            <p className="mt-1 text-xs text-ink/70 leading-relaxed line-clamp-2">
              {steps[currentNarratingIndex]?.detail}
            </p>

            {/* Accessibility Live Region */}
            <div className="sr-only" aria-live="polite" aria-atomic="true">
              {statusMessage || `Stage ${currentNarratingIndex + 1}: ${steps[currentNarratingIndex]?.title}`}
            </div>
          </div>

          {/* Master Player Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Playback Action Buttons */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Previous Stage */}
              <button
                type="button"
                onClick={handlePrevStage}
                disabled={currentNarratingIndex === 0}
                aria-label="Previous roadmap milestone"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-ink/15 bg-bg text-ink transition-all hover:border-accent hover:text-accent disabled:opacity-30 cursor-pointer shadow-xs"
                title="Previous Milestone"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              </button>

              {/* Master Play / Pause */}
              <button
                type="button"
                onClick={handlePlayToggle}
                aria-label={playing && !paused ? "Pause roadmap audiobook" : "Play roadmap audiobook"}
                className="inline-flex items-center gap-2 rounded-xl bg-bg border border-ink/20 px-4 py-2 text-xs font-semibold text-ink hover:border-accent hover:text-accent shadow-xs transition-colors cursor-pointer"
              >
                {playing && !paused ? (
                  <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  </svg>
                )}
                <span>
                  {playing ? (paused ? "Resume Narration" : "Pause Narration") : "Listen Full Roadmap"}
                </span>
              </button>

              {/* Stop Button */}
              {playing && (
                <button
                  type="button"
                  onClick={handleStop}
                  aria-label="Stop audio narration"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-danger/30 bg-bg text-danger transition-all hover:bg-danger/10 cursor-pointer shadow-xs"
                  title="Stop"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                  </svg>
                </button>
              )}

              {/* Next Stage */}
              <button
                type="button"
                onClick={handleNextStage}
                disabled={currentNarratingIndex === steps.length - 1}
                aria-label="Next roadmap milestone"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-ink/15 bg-bg text-ink transition-all hover:border-accent hover:text-accent disabled:opacity-30 cursor-pointer shadow-xs"
                title="Next Milestone"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Speed & Narration Options */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Playback Speed Pill Buttons */}
              <div className="flex items-center rounded-xl border border-ink/15 bg-bg p-0.5">
                {[0.75, 1.0, 1.25, 1.5].map((speed) => (
                  <button
                    key={speed}
                    type="button"
                    onClick={() => changeSpeed(speed)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
                      playbackSpeed === speed
                        ? "bg-surface text-accent font-bold shadow-2xs border border-ink/10"
                        : "text-ink/60 hover:text-ink"
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>

              {/* Continuous Auto-Advance Toggle */}
              <button
                type="button"
                onClick={() => setContinuousMode(!continuousMode)}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  continuousMode
                    ? "border-accent/40 bg-bg text-accent font-semibold"
                    : "border-ink/15 bg-bg text-ink/60 hover:text-ink"
                }`}
                title="Auto-play next milestone when current finishes"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Auto-Advance</span>
              </button>

              {/* Language Selector */}
              <select
                value={selectedLang}
                onChange={(e) => setSelectedLang(e.target.value)}
                className="rounded-xl border border-ink/15 bg-bg px-3 py-1.5 text-xs font-medium text-ink focus:border-accent focus:outline-none cursor-pointer"
                aria-label="Audiobook Voice Language"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code} className="bg-bg text-ink">
                    {l.nativeName} ({l.name})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
