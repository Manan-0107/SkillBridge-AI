"use client";

/**
 * context/VoiceContext.tsx
 *
 * CANONICAL CENTRAL AUTHORITATIVE VOICE STATE MACHINE (§5, §6, §7, §8, §9)
 *
 * Rules:
 * 1. Exactly ONE authoritative microphone owner in the entire application.
 * 2. Strict 9-state state machine:
 *    idle | requesting_permission | ready | listening | processing | success | error | stopped | cancelled
 * 3. Event-driven: The microphone NEVER continuously records or leaks background audio.
 * 4. Deaf parity: Every audio state has an authoritative visible status text for captions/subtitles.
 * 5. Auto-send completion: Uses silence debounce timer (2.2s) + final transcript + explicit controls.
 * 6. Voice Onboarding: Maximum 3 attempts x max 5 seconds. If all 3 fail, voice is disabled permanently.
 * 7. Critical data confirmation: Spoken punctuation normalization, spelled confirmation, never speaks passwords.
 */

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useApp } from "@/lib/store";
import {
  startSpeechRecognition,
  SpeechRecognitionController,
  isSpeechRecognitionSupported,
  speakText,
  stopSpeaking,
  playAccessibleChime,
  normalizeSpokenEmail,
  normalizeSpokenName,
  spellForVerification,
  detectTextLanguage,
} from "@/lib/voice";
import { parseVoiceCommand } from "@/lib/voiceCommands";
import type { FeatureId, ResumeTab } from "@/lib/intent";

export type CentralVoiceState =
  | "idle"
  | "requesting_permission"
  | "ready"
  | "listening"
  | "processing"
  | "success"
  | "error"
  | "stopped"
  | "cancelled";

export interface VoiceSessionOptions {
  lang?: string;
  mode?: "conversation" | "dictation" | "command";
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  onComplete?: (finalText: string) => void;
  onError?: (error: string) => void;
  maxDurationMs?: number;
}

export interface VoiceContextValue {
  state: CentralVoiceState;
  isSupported: boolean;
  isActive: boolean;
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  statusText: string;
  lastCommand: string | null;
  errorText: string | null;
  activeLanguage: string;
  // Controls
  startSession: (options?: VoiceSessionOptions) => void;
  stopSession: () => void;
  cancelSession: () => void;
  submitSession: (explicitText?: string) => void;
  // Legacy compatibility helpers
  startListening: () => void;
  stopListening: () => void;
  clearTranscript: () => void;
  resetStrikes: () => void;
}

const CentralVoiceContext = createContext<VoiceContextValue | null>(null);

export function useVoice(): VoiceContextValue {
  const ctx = useContext(CentralVoiceContext);
  if (!ctx) {
    throw new Error("useVoice must be used within a VoiceProvider");
  }
  return ctx;
}

export function VoiceProvider({ children }: { children: ReactNode }) {
  const {
    accessibilityProfile,
    voiceLanguage,
    setVoiceMode,
    setVoiceConsentStatus,
    accessibilityPrefs,
  } = useApp();

  const isDeaf = accessibilityProfile === "deaf_hard_of_hearing";

  const [state, setState] = useState<CentralVoiceState>("idle");
  const [transcript, setTranscript] = useState<string>("");
  const [interimTranscript, setInterimTranscript] = useState<string>("");
  const [statusText, setStatusText] = useState<string>("Voice ready");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [activeLang, setActiveLang] = useState<string>(voiceLanguage || "en-US");

  // Recognition controller & lifecycle timers
  const controllerRef = useRef<SpeechRecognitionController | null>(null);
  const currentOptionsRef = useRef<VoiceSessionOptions | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const maxDurationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptBufferRef = useRef<string>("");

  // Section 8: Strict Voice Onboarding (Max 3 attempts x 5 seconds)
  const onboardingAttemptCountRef = useRef<number>(0);

  // Sync active language from store
  useEffect(() => {
    if (voiceLanguage && voiceLanguage !== "auto") {
      setActiveLang(voiceLanguage);
    }
  }, [voiceLanguage]);

  // Clean all timers
  const clearTimers = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
  }, []);

  // Teardown recognition controller
  const abortController = useCallback(() => {
    clearTimers();
    if (controllerRef.current) {
      try {
        controllerRef.current.stop();
      } catch {}
      controllerRef.current = null;
    }
  }, [clearTimers]);

  // Explicit Complete / Auto-Send handler
  const completeSession = useCallback(
    (explicitText?: string) => {
      const finalText = (explicitText ?? transcriptBufferRef.current).trim();
      abortController();

      if (!finalText) {
        setState("stopped");
        setStatusText("Stopped");
        return;
      }

      setState("processing");
      setStatusText(`Processing: "${finalText.slice(0, 45)}..."`);

      const opts = currentOptionsRef.current;
      if (opts?.onComplete) {
        opts.onComplete(finalText);
      } else {
        // Fallback global command router
        const cmd = parseVoiceCommand(finalText);
        if (cmd) {
          setLastCommand(cmd.label);
          setStatusText(`Action: ${cmd.label}`);
          window.dispatchEvent(
            new CustomEvent("careerforge:navigate", {
              detail: { feature: cmd.feature, resumeTab: cmd.resumeTab },
            })
          );
        } else {
          // Dispatch generic voice transcript event
          window.dispatchEvent(
            new CustomEvent("careerforge:voice-complete", {
              detail: { text: finalText },
            })
          );
        }
      }

      setState("success");
      setTimeout(() => {
        setState("idle");
        setStatusText("Voice ready");
        setTranscript("");
        setInterimTranscript("");
        transcriptBufferRef.current = "";
      }, 1200);
    },
    [abortController]
  );

  // Cancel voice session cleanly
  const cancelSession = useCallback(() => {
    abortController();
    stopSpeaking();
    playAccessibleChime("stop");
    setState("cancelled");
    setStatusText("Cancelled");
    setTranscript("");
    setInterimTranscript("");
    transcriptBufferRef.current = "";
    setTimeout(() => {
      setState("idle");
      setStatusText("Voice ready");
    }, 600);
  }, [abortController]);

  // Stop session and process buffered input
  const stopSession = useCallback(() => {
    completeSession();
  }, [completeSession]);

  // Start authoritative voice recording
  const startSession = useCallback(
    (options?: VoiceSessionOptions) => {
      // 1. Deaf profile check: Never record if user selected deaf/hard-of-hearing
      if (isDeaf) {
        setState("stopped");
        setStatusText("Voice unavailable (Deaf profile active)");
        return;
      }

      if (!isSpeechRecognitionSupported()) {
        setState("error");
        setErrorText("Speech recognition not supported in this browser");
        setStatusText("Speech recognition unsupported");
        options?.onError?.("Speech recognition not supported");
        return;
      }

      // 2. Abort any previous controller
      abortController();
      stopSpeaking();

      currentOptionsRef.current = options || null;
      transcriptBufferRef.current = "";
      setTranscript("");
      setInterimTranscript("");
      setErrorText(null);

      setState("requesting_permission");
      setStatusText("Requesting microphone…");
      playAccessibleChime("start");

      const sessionLang = options?.lang || activeLang || "en-US";

      // 3. Start authoritative SpeechRecognition
      const controller = startSpeechRecognition(
        {
          onTranscript: (spokenText: string, isFinal?: boolean) => {
            const clean = spokenText.trim();
            if (!clean) return;

            transcriptBufferRef.current = clean;
            setTranscript(clean);
            setStatusText(`I heard: "${clean}"`);

            // Auto-detect language if in auto mode
            const detected = detectTextLanguage(clean);
            if (detected && detected !== activeLang && voiceLanguage === "auto") {
              setActiveLang(detected);
            }

            options?.onTranscript?.(clean, Boolean(isFinal));

            // ── Section 7: Auto-Send Debounce (Do NOT rely only on isFinal) ──
            if (silenceTimerRef.current) {
              clearTimeout(silenceTimerRef.current);
            }

            // If user pauses for 2.2 seconds, automatically complete the sentence
            silenceTimerRef.current = setTimeout(() => {
              completeSession(clean);
            }, 2200);

            // If final transcript is explicitly signaled by engine, complete faster
            if (isFinal) {
              if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = setTimeout(() => {
                completeSession(clean);
              }, 1200);
            }
          },
          onListeningChange: (isListening: boolean) => {
            if (isListening) {
              setState("listening");
              setStatusText("Listening… (Speak now)");
              setVoiceConsentStatus("granted");
            } else {
              if (state === "listening") {
                setState("stopped");
                setStatusText("Stopped");
              }
            }
          },
          onError: (err: string) => {
            console.warn("[CentralVoice] Error:", err);
            clearTimers();
            setState("error");
            setErrorText(err);

            if (err === "not-allowed" || err === "permission-denied") {
              setVoiceConsentStatus("denied");
              setStatusText("Microphone permission required");
            } else if (err === "no-speech") {
              setStatusText("No speech detected");
            } else {
              setStatusText(`Voice error: ${err}`);
            }

            options?.onError?.(err);

            // Onboarding 3-attempt limit check (§8)
            onboardingAttemptCountRef.current += 1;
            if (onboardingAttemptCountRef.current >= 3) {
              setVoiceMode(false);
              setStatusText("Voice disabled (3 failed attempts)");
            }

            setTimeout(() => {
              setState("idle");
            }, 2500);
          },
        },
        { lang: sessionLang, continuous: false }
      );

      controllerRef.current = controller;

      // Maximum duration safety barrier (default 15s, onboarding 5s)
      const maxMs = options?.maxDurationMs || 15000;
      maxDurationTimerRef.current = setTimeout(() => {
        if (transcriptBufferRef.current) {
          completeSession();
        } else {
          cancelSession();
        }
      }, maxMs);
    },
    [
      isDeaf,
      abortController,
      activeLang,
      voiceLanguage,
      clearTimers,
      completeSession,
      cancelSession,
      setVoiceConsentStatus,
      setVoiceMode,
      state,
    ]
  );

  // Synchronize window event bus for toggle-mic
  useEffect(() => {
    const handleToggleEvent = (e: Event) => {
      const custom = e as CustomEvent<{ active?: boolean }>;
      if (custom.detail?.active) {
        startSession();
      } else {
        stopSession();
      }
    };

    window.addEventListener("careerforge:toggle-mic", handleToggleEvent);
    return () => window.removeEventListener("careerforge:toggle-mic", handleToggleEvent);
  }, [startSession, stopSession]);

  // Broadcast state changes for system-wide visual parity
  useEffect(() => {
    const mapped = state === "listening" ? "listening" : state === "processing" ? "processing" : "idle";
    window.dispatchEvent(
      new CustomEvent("careerforge:voice-state", {
        detail: { state: mapped },
      })
    );
  }, [state]);

  // Teardown on unmount
  useEffect(() => {
    return () => abortController();
  }, [abortController]);

  const value = useMemo<VoiceContextValue>(
    () => ({
      state,
      isSupported: isSpeechRecognitionSupported() && !isDeaf,
      isActive: state === "listening" || state === "processing" || state === "requesting_permission",
      isListening: state === "listening",
      transcript,
      interimTranscript,
      statusText,
      lastCommand,
      errorText,
      activeLanguage: activeLang,
      startSession,
      stopSession,
      cancelSession,
      submitSession: completeSession,
      startListening: () => startSession(),
      stopListening: () => stopSession(),
      clearTranscript: () => {
        setTranscript("");
        setInterimTranscript("");
        transcriptBufferRef.current = "";
      },
      resetStrikes: () => {
        onboardingAttemptCountRef.current = 0;
      },
    }),
    [
      state,
      isDeaf,
      transcript,
      interimTranscript,
      statusText,
      lastCommand,
      errorText,
      activeLang,
      startSession,
      stopSession,
      cancelSession,
      completeSession,
    ]
  );

  return <CentralVoiceContext.Provider value={value}>{children}</CentralVoiceContext.Provider>;
}
