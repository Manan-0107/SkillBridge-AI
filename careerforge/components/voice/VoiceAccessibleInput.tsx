"use client";

/**
 * VoiceAccessibleInput.tsx
 *
 * Reference implementation of the standard pattern every voice-capable tab
 * in CareerForge should follow, now driven by GlobalVoiceProvider's
 * buttonless activation probe:
 *
 *   1. While `isPreferenceLoading` is true, the probe (DB check, then up to
 *      3 live mic attempts) is still deciding voice vs. text — render a
 *      neutral loading placeholder, nothing voice- or text-specific yet.
 *   2. Once resolved, read `isTextFallbackMode` (`= !isVoiceMode`).
 *      False → render the voice-listening UI (mic status, live transcript,
 *      attempt indicator). True → render a standard, fully
 *      keyboard/screen-reader accessible text form.
 *   3. Announce the transition itself via an `aria-live` region so
 *      screen-reader users aren't left listening to a mic UI that silently
 *      stopped working.
 *
 * Props let a parent tab decide what a "final" transcript/text submission
 * should do (e.g. populate a resume field, run a search) without this
 * component needing to know about app-specific state.
 */

import { useEffect, useRef, useState } from "react";
import { useGlobalVoice } from "@/providers/GlobalVoiceProvider";

export interface VoiceAccessibleInputProps {
  /** Field label shown to all users, spoken by screen readers either way. */
  label: string;
  placeholder?: string;
  /** Called with the finalized value, whether it came from voice or text. */
  onSubmitValue: (value: string) => void;
}

export function VoiceAccessibleInput({
  label,
  placeholder = "Start speaking, or type your response…",
  onSubmitValue,
}: VoiceAccessibleInputProps) {
  const {
    isListening,
    isRequestingPermission,
    hasRequestedPermission,
    isPreferenceLoading,
    transcript,
    interimTranscript,
    attemptsFailed,
    maxAttempts,
    isTextFallbackMode,
    permissionDenied,
    requestVoiceStart,
    retryVoiceMode,
    switchToTextMode,
  } = useGlobalVoice();

  const [textValue, setTextValue] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const prevFallbackRef = useRef(isTextFallbackMode);
  // Tracks whether we've ever finished an initial preference load, so we
  // don't announce a "switched to text" transition for a preference that
  // was simply restored from the database on page load — only for a
  // fallback that happens live, in front of the user, during this visit.
  const hasResolvedOnceRef = useRef(false);

  useEffect(() => {
    if (isPreferenceLoading) return;

    if (!hasResolvedOnceRef.current) {
      hasResolvedOnceRef.current = true;
      prevFallbackRef.current = isTextFallbackMode;
      return;
    }

    if (!prevFallbackRef.current && isTextFallbackMode) {
      setAnnouncement(
        permissionDenied
          ? "Microphone access was denied. Switched to a text input so you can continue."
          : "No voice input was detected after three attempts. Switched to a text input so you can continue."
      );
    }
    prevFallbackRef.current = isTextFallbackMode;
  }, [isPreferenceLoading, isTextFallbackMode, permissionDenied]);

  // Keep the visible text field in sync with finalized voice transcript,
  // so switching modes mid-thought doesn't lose what was already captured.
  useEffect(() => {
    if (transcript) setTextValue(transcript);
  }, [transcript]);

  const handleTextSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = textValue.trim();
    if (trimmed) onSubmitValue(trimmed);
  };

  return (
    <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      {/* Live region: announced to screen readers, visually hidden. */}
      <div aria-live="polite" role="status" className="sr-only">
        {announcement}
      </div>

      <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
        {label}
      </h3>

      {isPreferenceLoading ? (
        <PreferenceLoadingSkeleton />
      ) : !isTextFallbackMode ? (
        <VoiceMode
          isListening={isListening}
          isRequestingPermission={isRequestingPermission}
          hasRequestedPermission={hasRequestedPermission}
          transcript={transcript}
          interimTranscript={interimTranscript}
          attemptsFailed={attemptsFailed}
          maxAttempts={maxAttempts}
          onEnableMic={requestVoiceStart}
          onSwitchToText={switchToTextMode}
        />
      ) : (
        <TextFallbackMode
          value={textValue}
          placeholder={placeholder}
          onChange={setTextValue}
          onSubmit={handleTextSubmit}
          onRetryVoice={retryVoiceMode}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading state — shown while the server-side preference is being fetched,
// so we never flash voice UI at a user who has already permanently fallen
// back to text (and never flash text UI at a user who hasn't, either).
// ---------------------------------------------------------------------------

function PreferenceLoadingSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="space-y-3"
    >
      <span className="sr-only">
        Checking for voice input — please feel free to speak now…
      </span>
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-3 w-3 flex-shrink-0 rounded-full bg-slate-200 dark:bg-slate-700" />
        <div className="h-3 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
      </div>
      <div
        aria-hidden="true"
        className="h-14 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800"
      />
      <div className="flex gap-2" aria-hidden="true">
        <div className="h-8 w-32 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
        <div className="h-8 w-28 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Voice-centric UI
// ---------------------------------------------------------------------------

interface VoiceModeProps {
  isListening: boolean;
  isRequestingPermission: boolean;
  hasRequestedPermission: boolean;
  transcript: string;
  interimTranscript: string;
  attemptsFailed: number;
  maxAttempts: number;
  onEnableMic: () => void;
  onSwitchToText: () => void;
}

function VoiceMode({
  isListening,
  isRequestingPermission,
  hasRequestedPermission,
  transcript,
  interimTranscript,
  attemptsFailed,
  maxAttempts,
  onEnableMic,
  onSwitchToText,
}: VoiceModeProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={`h-3 w-3 flex-shrink-0 rounded-full transition-colors ${
            isListening
              ? "animate-pulse bg-emerald-500"
              : "bg-slate-300 dark:bg-slate-700"
          }`}
        />
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {isListening
            ? "Listening…"
            : isRequestingPermission
              ? "Requesting microphone access…"
              : hasRequestedPermission
                ? "Microphone paused — reconnecting…"
                : "Voice input is ready."}
        </p>
      </div>

      <div
        aria-label="Live transcript"
        className="min-h-[3.5rem] rounded-lg bg-slate-50 p-3 text-sm text-slate-800 dark:bg-slate-800 dark:text-slate-100"
      >
        {transcript || interimTranscript ? (
          <>
            <span>{transcript}</span>{" "}
            <span className="text-slate-400 dark:text-slate-500">
              {interimTranscript}
            </span>
          </>
        ) : (
          <span className="text-slate-400 dark:text-slate-500">
            Nothing heard yet — try speaking clearly into your microphone.
          </span>
        )}
      </div>

      {/* Attempt indicator — visible + announced so a screen reader user
          knows how many attempts remain before fallback kicks in. */}
      <div
        role="status"
        aria-live="polite"
        className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400"
      >
        <span>
          {attemptsFailed > 0
            ? `Attempt ${attemptsFailed} of ${maxAttempts} without clear audio.`
            : "No issues detected."}
        </span>
        <div className="flex gap-1" aria-hidden="true">
          {Array.from({ length: maxAttempts }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-4 rounded-full ${
                i < attemptsFailed
                  ? "bg-amber-400"
                  : "bg-slate-200 dark:bg-slate-700"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        {!isListening && !isRequestingPermission && (
          <button
            type="button"
            onClick={onEnableMic}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            Enable microphone
          </button>
        )}
        <button
          type="button"
          onClick={onSwitchToText}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Use text instead
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Text fallback UI — the accessible, always-available baseline.
// ---------------------------------------------------------------------------

interface TextFallbackModeProps {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onRetryVoice: () => void;
}

function TextFallbackMode({
  value,
  placeholder,
  onChange,
  onSubmit,
  onRetryVoice,
}: TextFallbackModeProps) {
  const fieldId = "voice-fallback-textarea";

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label htmlFor={fieldId} className="sr-only">
        {placeholder}
      </label>
      <textarea
        id={fieldId}
        name="voiceFallbackText"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          Submit
        </button>
        <button
          type="button"
          onClick={onRetryVoice}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Try voice again
        </button>
      </div>
    </form>
  );
}
