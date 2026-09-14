"use client";

import { useEffect, useRef } from "react";

/**
 * Subscribe to the single site-wide speech recogniser.
 *
 * There is exactly one `SpeechRecognition` instance in the app — the persistent
 * one in `context/VoiceContext.tsx`. It broadcasts every transcript (interim and
 * final) on a `careerforge:voice-transcript` window event. Components that used
 * to call `startSpeechRecognition` themselves now just listen here, so they
 * never contend for the microphone or re-prompt for permission.
 *
 * Pass `enabled = false` to ignore transcripts (e.g. while a mic toggle is off).
 */
export function useSharedTranscript(
  onTranscript: (text: string, isFinal: boolean) => void,
  enabled = true
) {
  const cb = useRef(onTranscript);
  cb.current = onTranscript;

  useEffect(() => {
    if (!enabled) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ text: string; isFinal: boolean }>).detail;
      if (detail?.text) cb.current(detail.text, !!detail.isFinal);
    };
    window.addEventListener("careerforge:voice-transcript", handler);
    return () => window.removeEventListener("careerforge:voice-transcript", handler);
  }, [enabled]);
}

/** Ask the site-wide recogniser to (re)start listening — e.g. from a feature's mic button. */
export function requestSharedVoiceStart() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("careerforge:voice-request-start"));
  }
}
