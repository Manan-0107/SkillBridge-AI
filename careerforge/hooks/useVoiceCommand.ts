"use client";

/**
 * useVoiceCommand.ts
 *
 * Manages the full lifecycle of the Web Speech API (`SpeechRecognition`) for
 * CareerForge's global voice command system:
 *   - Cross-browser vendor prefix resolution (webkitSpeechRecognition, etc.)
 *   - Continuous listening with automatic restart on silence-driven termination
 *   - A "3 strikes" failure counter for no-speech / audio-capture errors
 *   - Reporting terminal failure up to the caller (typically GlobalVoiceProvider)
 *     so it can flip global fallback state.
 *
 * This hook intentionally does NOT own global/shared state itself — it is a
 * self-contained engine. GlobalVoiceProvider wires its callbacks into context
 * so every tab/component can react to the same listening + fallback state.
 */

import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Minimal Web Speech API typings (not consistently shipped in lib.dom.d.ts)
// ---------------------------------------------------------------------------

interface SpeechRecognitionErrorEvent extends Event {
  error:
    | "no-speech"
    | "audio-capture"
    | "not-allowed"
    | "network"
    | "aborted"
    | "service-not-allowed"
    | "bad-grammar"
    | "language-not-supported"
    | string;
  message?: string;
}

interface SpeechRecognitionResultLike {
  0: { transcript: string; confidence: number };
  isFinal: boolean;
  length: number;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onaudiostart: (() => void) | null;
  onsoundend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

function resolveSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const MAX_STRIKES = 3;

/** Errors that count as a "failed attempt" toward the 3-strike threshold. */
const STRIKE_ELIGIBLE_ERRORS = new Set(["no-speech", "audio-capture"]);

/**
 * Errors that mean the user actively refused/can't grant mic access.
 * These should push straight to fallback rather than waiting on the
 * strike counter — retrying won't help without a permissions change.
 */
const HARD_FAILURE_ERRORS = new Set(["not-allowed", "service-not-allowed"]);

export interface UseVoiceCommandOptions {
  lang?: string;
  /** Called once the strike threshold is reached (or a hard permission failure occurs). */
  onFallbackTriggered?: () => void;
  /** Called with the latest final transcript segment. */
  onResult?: (transcript: string) => void;
  /**
   * Called once per listening cycle, the first moment ANY audio is
   * recognized (interim or final) — i.e. "the mic picked up speech",
   * independent of whether a final transcript has formed yet. Useful for
   * activation flows that just need to know a human is talking.
   */
  onSpeechDetected?: () => void;
  /** Whether the hook should actively try to keep the mic listening. */
  enabled?: boolean;
}

export interface UseVoiceCommandReturn {
  isSupported: boolean;
  isListening: boolean;
  /** True while we're mid-request for mic permission. */
  isRequestingPermission: boolean;
  transcript: string;
  interimTranscript: string;
  strikes: number;
  maxStrikes: number;
  permissionDenied: boolean;
  start: () => void;
  stop: () => void;
  resetStrikes: () => void;
}

export function useVoiceCommand(
  options: UseVoiceCommandOptions = {}
): UseVoiceCommandReturn {
  const { lang = "en-US", onFallbackTriggered, onResult, onSpeechDetected, enabled = true } =
    options;

  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [strikes, setStrikes] = useState(0);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const strikesRef = useRef(0);
  const intentionalStopRef = useRef(false);
  const fallbackFiredRef = useRef(false);
  const heardSpeechSinceStartRef = useRef(false);
  /**
   * Guards against counting the same failed attempt twice: a "no-speech"
   * error fires `onerror`, and the recognizer then also fires `onend`
   * shortly after — without this guard, `onend`'s "heard nothing, that's a
   * strike" logic would register a second strike for the exact same
   * silence. Reset once per listening cycle, in `onstart`.
   */
  const strikeRegisteredThisCycleRef = useRef(false);

  const triggerFallback = useCallback(() => {
    if (fallbackFiredRef.current) return;
    fallbackFiredRef.current = true;
    intentionalStopRef.current = true;
    recognitionRef.current?.stop();
    setIsListening(false);
    onFallbackTriggered?.();
  }, [onFallbackTriggered]);

  const registerStrike = useCallback(() => {
    strikesRef.current += 1;
    setStrikes(strikesRef.current);
    if (strikesRef.current >= MAX_STRIKES) {
      triggerFallback();
    }
  }, [triggerFallback]);

  const resetStrikes = useCallback(() => {
    strikesRef.current = 0;
    fallbackFiredRef.current = false;
    setStrikes(0);
  }, []);

  const buildRecognition = useCallback((): SpeechRecognitionLike | null => {
    const Ctor = resolveSpeechRecognitionCtor();
    if (!Ctor) return null;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      heardSpeechSinceStartRef.current = false;
      strikeRegisteredThisCycleRef.current = false;
      setIsListening(true);
      setIsRequestingPermission(false);
    };

    recognition.onaudiostart = () => {
      setPermissionDenied(false);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      if (!heardSpeechSinceStartRef.current) {
        onSpeechDetected?.();
      }
      heardSpeechSinceStartRef.current = true;
      // A successful result resets the strike streak — failures must be
      // consecutive gaps in valid input, not a lifetime total.
      if (strikesRef.current > 0) resetStrikes();

      let finalChunk = "";
      let interimChunk = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
          finalChunk += result[0].transcript;
        } else {
          interimChunk += result[0].transcript;
        }
      }
      if (finalChunk) {
        setTranscript((prev) => `${prev} ${finalChunk}`.trim());
        onResult?.(finalChunk.trim());
      }
      setInterimTranscript(interimChunk);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (HARD_FAILURE_ERRORS.has(event.error)) {
        setPermissionDenied(true);
        setIsRequestingPermission(false);
        triggerFallback();
        return;
      }
      if (STRIKE_ELIGIBLE_ERRORS.has(event.error)) {
        strikeRegisteredThisCycleRef.current = true;
        registerStrike();
      }
      // Other transient errors (e.g. "network", "aborted") fall through to
      // onend, which handles the auto-restart / strike bookkeeping.
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript("");

      if (intentionalStopRef.current) {
        intentionalStopRef.current = false;
        return;
      }

      if (fallbackFiredRef.current || !enabled) return;

      // Recognition ended without us asking it to. If it ended having heard
      // nothing at all in this session, that's silence — count it as a
      // strike, UNLESS onerror already registered one for this same cycle.
      // Either way, restart to simulate persistent listening.
      if (!heardSpeechSinceStartRef.current && !strikeRegisteredThisCycleRef.current) {
        registerStrike();
      }
      if (!fallbackFiredRef.current) {
        try {
          recognition.start();
        } catch {
          // start() throws if called while already starting; safe to ignore,
          // the next onend cycle will retry.
        }
      }
    };

    return recognition;
  }, [
    enabled,
    lang,
    onResult,
    onSpeechDetected,
    registerStrike,
    resetStrikes,
    triggerFallback,
  ]);

  const start = useCallback(() => {
    if (!enabled || fallbackFiredRef.current) return;
    const Ctor = resolveSpeechRecognitionCtor();
    if (!Ctor) {
      setIsSupported(false);
      triggerFallback();
      return;
    }
    setIsSupported(true);
    setIsRequestingPermission(true);
    intentionalStopRef.current = false;

    if (!recognitionRef.current) {
      recognitionRef.current = buildRecognition();
    }
    try {
      recognitionRef.current?.start();
    } catch {
      // Already running — ignore. Some browsers throw InvalidStateError
      // when start() is called on an already-active recognizer.
      setIsRequestingPermission(false);
    }
  }, [buildRecognition, enabled, triggerFallback]);

  const stop = useCallback(() => {
    intentionalStopRef.current = true;
    recognitionRef.current?.stop();
    setIsListening(false);
    setIsRequestingPermission(false);
  }, []);

  useEffect(() => {
    setIsSupported(Boolean(resolveSpeechRecognitionCtor()));
    return () => {
      intentionalStopRef.current = true;
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    isSupported,
    isListening,
    isRequestingPermission,
    transcript,
    interimTranscript,
    strikes,
    maxStrikes: MAX_STRIKES,
    permissionDenied,
    start,
    stop,
    resetStrikes,
  };
}
