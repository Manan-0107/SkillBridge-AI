"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useApp } from "@/lib/store";
import {
  startSpeechRecognition,
  SpeechRecognitionController,
  detectTextLanguage,
  speakText,
  stopSpeaking,
} from "@/lib/voice";
import { useGlobalVoice } from "@/providers/GlobalVoiceProvider";

export function VoiceModeDetector() {
  const { user, voiceLanguage } = useApp();
  const { retryVoiceMode, switchToTextMode } = useGlobalVoice();
  const [attempt, setAttempt] = useState<number>(1);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(5);
  const [listening, setListening] = useState(false);
  const [detectedText, setDetectedText] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [checked, setChecked] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionController | null>(null);
  const windowTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const attemptRef = useRef<number>(1);

  const stopActiveSession = useCallback(() => {
    stopSpeaking();
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (windowTimeoutRef.current) {
      clearTimeout(windowTimeoutRef.current);
      windowTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setListening(false);
  }, []);

  const handleVoiceSuccess = useCallback((transcript: string) => {
    stopActiveSession();
    setDetectedText(transcript);
    setChecked(true);
    setModalOpen(false);

    try {
      localStorage.setItem("careerforge_voice_calibrated", "enabled");
    } catch {}

    retryVoiceMode();

    const detectedLang = detectTextLanguage(transcript) || voiceLanguage || "en-US";
    const welcomeMessages: Record<string, string> = {
      "hi-IN": "वॉयस एक्सेसिबिलिटी सक्रिय हो गई है। करियरफोर्ज में आपका स्वागत है।",
      "gu-IN": "વોઈસ એક્સેસિબિલિટી સક્રિય થઈ ગઈ છે. કરિયરફોર્જમાં આપનું સ્વાગત છે.",
      "en-US": "Voice accessibility enabled. Welcome to CareerForge. You can ask me anything or say open my roadmap.",
      "en-IN": "Voice accessibility enabled. Welcome to CareerForge. You can ask me anything or say open my roadmap.",
    };

    const msg = welcomeMessages[detectedLang] || welcomeMessages["en-US"];
    speakText(msg, { lang: detectedLang });
  }, [retryVoiceMode, stopActiveSession, voiceLanguage]);

  const handleFallbackToText = useCallback(() => {
    stopActiveSession();
    setModalOpen(false);
    setChecked(true);

    try {
      localStorage.setItem("careerforge_voice_calibrated", "disabled");
    } catch {}

    switchToTextMode();
    speakText("Voice detection completed. Continuing in standard text mode.", { lang: "en-US" });
  }, [stopActiveSession, switchToTextMode]);

  const runAttempt = useCallback((currentAttempt: number) => {
    attemptRef.current = currentAttempt;
    setAttempt(currentAttempt);
    setSecondsRemaining(5);
    setListening(true);

    const prompts: Record<number, string> = {
      1: "Please say something. You can say your name or tell me what you would like to learn.",
      2: "Attempt two. Please say something.",
      3: "Attempt three. Please say something.",
    };

    const promptText = prompts[currentAttempt] || "Please say something.";
    speakText(promptText, {
      lang: voiceLanguage && voiceLanguage !== "auto" ? voiceLanguage : "en-US",
      onEnd: () => {
        // Start listening precisely after audio prompt finishes
        try {
          recognitionRef.current = startSpeechRecognition({
            lang: voiceLanguage && voiceLanguage !== "auto" ? voiceLanguage : "en-US",
            onTranscript: (transcript: string) => {
              const clean = transcript.trim();
              if (clean.length > 0) {
                handleVoiceSuccess(clean);
              }
            },
            onListeningChange: (isList: boolean) => setListening(isList),
            onError: () => {
              // Proceed to next attempt after timeout window expires
            },
          });
        } catch {
          // If browser speech recognition is completely unavailable
          handleFallbackToText();
          return;
        }

        // 5-second countdown timer for visual/deaf feedback
        let timeLeft = 5;
        countdownIntervalRef.current = setInterval(() => {
          timeLeft -= 1;
          setSecondsRemaining(Math.max(0, timeLeft));
        }, 1000);

        // 5-second window per attempt
        windowTimeoutRef.current = setTimeout(() => {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
          }

          if (currentAttempt < 3) {
            runAttempt(currentAttempt + 1);
          } else {
            // All 3 attempts exhausted without interpretable speech
            handleFallbackToText();
          }
        }, 5000);
      },
    });
  }, [handleFallbackToText, handleVoiceSuccess, voiceLanguage]);

  useEffect(() => {
    const handleCalibrate = () => {
      setModalOpen(true);
      const timer = setTimeout(() => {
        runAttempt(1);
      }, 300);
      return () => clearTimeout(timer);
    };

    window.addEventListener("careerforge:calibrate-voice" as any, handleCalibrate);
    return () => window.removeEventListener("careerforge:calibrate-voice" as any, handleCalibrate);
  }, [runAttempt]);

  useEffect(() => {
    return () => {
      stopActiveSession();
    };
  }, [stopActiveSession]);

  if (!modalOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-check-title"
      aria-describedby="voice-check-desc"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-xs p-4 animate-in fade-in"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-ink/15 bg-surface p-6 shadow-xl text-center text-ink">
        {/* Header Badge */}
        <div className="flex items-center justify-between pb-3 border-b border-ink/10 mb-4">
          <span className="text-[11px] font-mono uppercase tracking-wider text-ink/60">
            Voice Accessibility Calibration
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-bg border border-ink/15 text-accent font-semibold">
            Attempt {attempt} of 3
          </span>
        </div>

        {/* Visual Pulse Indicator & Timer */}
        <div className="my-5 flex flex-col items-center justify-center gap-2">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-bg border border-accent/40 shadow-xs">
            <svg
              className={`w-7 h-7 text-accent ${listening ? "animate-pulse" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
            {listening && (
              <span className="absolute -inset-1 rounded-full border border-accent/30 animate-ping pointer-events-none" />
            )}
          </div>
          <span className="text-xs font-mono text-ink/60">
            {listening ? `Listening... (${secondsRemaining}s)` : "Preparing prompt..."}
          </span>
        </div>

        <h2 id="voice-check-title" className="text-base font-bold text-ink">
          Voice Capability Detection
        </h2>
        <p id="voice-check-desc" className="mt-1 text-xs text-ink/75 leading-relaxed">
          Please say something. You can say your name or tell me what you would like to learn.
        </p>

        {/* Live Audio Waves Animation for Deaf Users */}
        <div
          aria-hidden="true"
          className="mt-4 flex items-center justify-center gap-1.5 h-6"
        >
          <span
            className={`w-1 rounded-full bg-accent transition-all ${
              listening ? "h-5 animate-pulse" : "h-1 opacity-30"
            }`}
          />
          <span
            className={`w-1 rounded-full bg-accent transition-all ${
              listening ? "h-6 animate-pulse delay-75" : "h-1 opacity-30"
            }`}
          />
          <span
            className={`w-1 rounded-full bg-accent transition-all ${
              listening ? "h-4 animate-pulse delay-150" : "h-1 opacity-30"
            }`}
          />
          <span
            className={`w-1 rounded-full bg-accent transition-all ${
              listening ? "h-5 animate-pulse delay-100" : "h-1 opacity-30"
            }`}
          />
        </div>

        {/* Live Transcript Live Region for Deaf Users */}
        <div aria-live="polite" className="mt-3 min-h-[28px]">
          {detectedText ? (
            <p className="text-xs font-medium text-accent bg-bg py-1 px-2.5 rounded-lg border border-accent/20">
              Heard: &quot;{detectedText}&quot;
            </p>
          ) : (
            <p className="text-[11px] font-mono text-ink/50">
              {listening ? "Awaiting speech..." : "Checking system audio..."}
            </p>
          )}
        </div>

        {/* Action Controls */}
        <div className="mt-6 flex items-center justify-center gap-3 pt-3 border-t border-ink/10">
          <button
            type="button"
            onClick={handleFallbackToText}
            className="flex-1 rounded-xl border border-ink/20 bg-bg px-3 py-2 text-xs font-medium text-ink/80 hover:bg-surface hover:text-ink transition-colors cursor-pointer"
          >
            Continue in Text Mode
          </button>
          <button
            type="button"
            onClick={() => handleVoiceSuccess("Manual voice activation")}
            className="flex-1 rounded-xl border border-accent/40 bg-surface px-3 py-2 text-xs font-semibold text-accent hover:border-accent hover:shadow-xs transition-all cursor-pointer"
          >
            Enable Voice Mode
          </button>
        </div>
      </div>
    </div>
  );
}
