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
  const handlePlayToggle = () => {
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
  };

  const handleStop = () => {
    stopSpeaking();
    setPlaying(false);
    setPaused(false);
    playAccessibleChime("stop");
    setStatusMessage("Audiobook stopped");
  };

  const handleNextStage = () => {
    stopSpeaking();
    const nextIdx = Math.min(steps.length - 1, currentNarratingIndex + 1);
    narrateStage(nextIdx);
  };

  const handlePrevStage = () => {
    stopSpeaking();
    const prevIdx = Math.max(0, currentNarratingIndex - 1);
    narrateStage(prevIdx);
  };

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
      className="mb-8 rounded-3xl border border-indigo-200/80 bg-gradient-to-br from-indigo-950 via-slate-900 to-neutral-950 p-5 sm:p-6 text-white shadow-xl shadow-indigo-950/20 ring-1 ring-white/10"
    >
      {/* Top Bar / Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600/90 text-2xl shadow-inner ring-1 ring-white/20">
            🎧
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400 border border-emerald-500/30">
                Accessibility Audiobook Mode
              </span>
              <span className="text-xs text-neutral-400">&bull;</span>
              <span className="text-xs text-neutral-300 font-medium">
                {steps.length} Milestones
              </span>
            </div>
            <h3 className="text-base font-bold tracking-tight text-white sm:text-lg">
              Listen to Your Career Roadmap
            </h3>
          </div>
        </div>

        {/* Expand / Minimize Toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-neutral-300 hover:bg-white/10 transition-colors cursor-pointer"
          >
            {expanded ? "Collapse Player ▾" : "Expand Player ▴"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-5 space-y-5">
          {/* Active Stage Narration Card */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                Now Playing: Milestone {currentNarratingIndex + 1} of {steps.length}
              </span>
              {playing && !paused && (
                <div className="flex items-center gap-1 h-3">
                  <span className="h-2 w-1 rounded-full bg-indigo-400 animate-pulse" />
                  <span className="h-3.5 w-1 rounded-full bg-indigo-300 animate-pulse delay-75" />
                  <span className="h-2.5 w-1 rounded-full bg-indigo-400 animate-pulse delay-150" />
                  <span className="h-1.5 w-1 rounded-full bg-indigo-500 animate-pulse" />
                </div>
              )}
            </div>

            <h4 className="text-lg font-bold text-white">
              {steps[currentNarratingIndex]?.title}
            </h4>
            <p className="mt-1 text-xs text-neutral-300 leading-relaxed line-clamp-2">
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
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-sm font-bold text-white transition-all hover:bg-white/15 disabled:opacity-30 cursor-pointer"
                title="Previous Milestone"
              >
                ⏮️
              </button>

              {/* Master Play / Pause */}
              <button
                type="button"
                onClick={handlePlayToggle}
                aria-label={playing && !paused ? "Pause roadmap audiobook" : "Play roadmap audiobook"}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 transition-all hover:from-indigo-600 hover:to-indigo-700 active:scale-95 cursor-pointer"
              >
                <span className="text-base">
                  {playing && !paused ? "⏸️" : "▶️"}
                </span>
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
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 text-sm font-bold text-rose-400 transition-all hover:bg-rose-500/20 cursor-pointer"
                  title="Stop"
                >
                  ⏹️
                </button>
              )}

              {/* Next Stage */}
              <button
                type="button"
                onClick={handleNextStage}
                disabled={currentNarratingIndex === steps.length - 1}
                aria-label="Next roadmap milestone"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-sm font-bold text-white transition-all hover:bg-white/15 disabled:opacity-30 cursor-pointer"
                title="Next Milestone"
              >
                ⏭️
              </button>
            </div>

            {/* Speed & Narration Options */}
            <div className="flex flex-wrap items-center gap-3">
              
              {/* Playback Speed Pill Buttons */}
              <div className="flex items-center rounded-xl border border-white/15 bg-white/5 p-1">
                {[0.75, 1.0, 1.25, 1.5].map((speed) => (
                  <button
                    key={speed}
                    type="button"
                    onClick={() => changeSpeed(speed)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                      playbackSpeed === speed
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-neutral-400 hover:text-white"
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
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  continuousMode
                    ? "border-indigo-400/50 bg-indigo-500/15 text-indigo-200"
                    : "border-white/15 bg-white/5 text-neutral-400"
                }`}
                title="Auto-play next milestone when current finishes"
              >
                <span>🔄</span>
                <span>Auto-Advance</span>
              </button>

              {/* Language Selector */}
              <select
                value={selectedLang}
                onChange={(e) => setSelectedLang(e.target.value)}
                className="rounded-xl border border-white/15 bg-slate-900 px-3 py-1.5 text-xs font-medium text-white focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer"
                aria-label="Audiobook Voice Language"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.flag} {l.nativeName} ({l.name})
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
