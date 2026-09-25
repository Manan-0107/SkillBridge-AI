"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useApp, AccessibilityProfile } from "@/lib/store";
import { playAccessibleChime } from "@/lib/voice";

export type AssistantVoiceState = "idle" | "listening" | "processing" | "speaking" | "error";

interface AccessibilitySettings {
  highContrast: boolean;
  fontSizeMultiplier: number;
  speechRate: number;
  captionSize: "normal" | "large" | "xlarge";
  soundEffects: boolean;
}

const DEFAULT_SETTINGS: AccessibilitySettings = {
  highContrast: false,
  fontSizeMultiplier: 1.0,
  speechRate: 1.0,
  captionSize: "large",
  soundEffects: true,
};

export function FloatingControlBar() {
  const {
    accessibilityProfile,
    setAccessibilityProfile,
    voiceConsentStatus,
    setVoiceConsentStatus,
  } = useApp();

  const [voiceState, setVoiceState] = useState<AssistantVoiceState>("idle");
  const [liveCaption, setLiveCaption] = useState<string>("");
  const [speakerLabel, setSpeakerLabel] = useState<string>("CareerForge");
  const [amplitude, setAmplitude] = useState<number>(0);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [settings, setSettings] = useState<AccessibilitySettings>(DEFAULT_SETTINGS);
  const [permissionBlockedNotice, setPermissionBlockedNotice] = useState<boolean>(false);
  const [minimized, setMinimized] = useState<boolean>(false);

  const micButtonRef = useRef<HTMLButtonElement>(null);
  const settingsPanelRef = useRef<HTMLDivElement>(null);

  const isDeafProfile = accessibilityProfile === "deaf_hard_of_hearing";
  const isBlindProfile = accessibilityProfile === "blind_low_vision";

  // Check microphone permissions silently on mount without prompting native dialog
  useEffect(() => {
    if (typeof window === "undefined" || isDeafProfile) return;

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: "microphone" as PermissionName })
        .then((permissionStatus) => {
          if (permissionStatus.state === "granted") {
            setVoiceConsentStatus("granted");
            setPermissionBlockedNotice(false);
            if (isBlindProfile) {
              window.dispatchEvent(
                new CustomEvent("careerforge:toggle-mic", { detail: { active: true } })
              );
            }
          } else if (permissionStatus.state === "denied") {
            setVoiceConsentStatus("denied");
          } else {
            setVoiceConsentStatus("not_requested");
          }

          permissionStatus.onchange = () => {
            if (permissionStatus.state === "granted") {
              setVoiceConsentStatus("granted");
              setPermissionBlockedNotice(false);
            } else if (permissionStatus.state === "denied") {
              setVoiceConsentStatus("denied");
            }
          };
        })
        .catch(() => {});
    }
  }, [isDeafProfile, isBlindProfile, setVoiceConsentStatus]);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("careerforge_a11y_prefs");
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings((prev) => ({ ...prev, ...parsed }));
      }
    } catch {}
  }, []);

  // Sync settings changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("careerforge_a11y_prefs", JSON.stringify(settings));
    } catch {}
  }, [settings]);

  // Listen to custom audio and accessibility events
  useEffect(() => {
    const handleVoiceState = (e: CustomEvent<{ state: AssistantVoiceState; amplitude?: number }>) => {
      if (e.detail?.state) {
        setVoiceState(e.detail.state);
        if (e.detail.amplitude !== undefined) {
          setAmplitude(e.detail.amplitude);
        }
      }
    };

    const handleCaption = (e: CustomEvent<{ text: string; speaker?: string }>) => {
      if (e.detail?.text) {
        setLiveCaption(e.detail.text);
        if (e.detail.speaker) {
          setSpeakerLabel(e.detail.speaker);
        }
      }
    };

    window.addEventListener("careerforge:voice-state" as any, handleVoiceState);
    window.addEventListener("careerforge:live-caption" as any, handleCaption);

    return () => {
      window.removeEventListener("careerforge:voice-state" as any, handleVoiceState);
      window.removeEventListener("careerforge:live-caption" as any, handleCaption);
    };
  }, []);

  // Global hotkey Alt+V for voice toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === "v" || e.key === "V")) {
        e.preventDefault();
        toggleAssistant();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const toggleAssistant = useCallback(() => {
    if (isDeafProfile) return;

    if (voiceConsentStatus === "denied") {
      setPermissionBlockedNotice(true);
      return;
    }

    if (settings.soundEffects) {
      playAccessibleChime(voiceState === "listening" ? "stop" : "start");
    }

    const nextState = voiceState === "listening" ? "idle" : "listening";
    setVoiceState(nextState);

    window.dispatchEvent(
      new CustomEvent("careerforge:toggle-mic", {
        detail: { active: nextState === "listening" },
      })
    );
  }, [voiceState, voiceConsentStatus, isDeafProfile, settings.soundEffects]);

  return (
    <>
      {/* Offscreen ARIA Live Region for Screen Readers */}
      <div
        id="voice-assistant-announcer"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {liveCaption ? `${speakerLabel}: ${liveCaption}` : `Voice assistant is currently ${voiceState}.`}
      </div>

      {minimized ? (
        <aside
          role="region"
          aria-label="Voice Assistant Controls (Minimized)"
          className="fixed bottom-3 right-4 z-50"
        >
          <button
            type="button"
            onClick={() => setMinimized(false)}
            aria-label="Expand Voice Assistant Controls"
            className="group flex items-center gap-2 rounded-full border border-ink/20 bg-surface px-3 py-1.5 text-xs font-semibold text-ink shadow-md hover:border-accent/40 transition-all cursor-pointer"
          >
            {!isDeafProfile && (
              <span
                className={`h-2 w-2 rounded-full ${
                  voiceState === "listening"
                    ? "bg-accent animate-pulse"
                    : voiceState === "speaking"
                    ? "bg-success animate-pulse"
                    : "bg-ink/40"
                }`}
                aria-hidden="true"
              />
            )}
            <span>Voice Assistant</span>
            <span className="text-[10px] text-ink/60 bg-bg px-1.5 py-0.5 rounded border border-ink/10 font-mono">
              Alt+V
            </span>
          </button>
        </aside>
      ) : (
        <aside
          id="voice-assistant-controls"
          role="region"
          aria-label="Accessibility and Voice Assistant Controls"
          className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 w-[94vw] max-w-xl transition-all duration-200"
        >
          {permissionBlockedNotice && (
            <div
              role="alert"
              className="mb-2 flex items-center justify-between rounded-xl border border-danger/40 bg-surface px-4 py-2 text-xs text-danger font-medium shadow-md"
            >
              <span>
                Microphone access is blocked in browser settings. Enable permission to use voice.
              </span>
              <button
                type="button"
                onClick={() => setPermissionBlockedNotice(false)}
                className="ml-3 rounded font-bold hover:text-ink cursor-pointer"
                aria-label="Dismiss microphone blocked alert"
              >
                ✕
              </button>
            </div>
          )}

          <div className="rounded-2xl border border-ink/15 bg-surface/95 p-2 sm:px-3 sm:py-2 text-ink shadow-lg shadow-ink/5 backdrop-blur-md">
            <div className="flex items-center justify-between gap-2 sm:gap-3">
              {/* Mic Toggle or Deaf Caption Badge */}
              {!isDeafProfile ? (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    ref={micButtonRef}
                    type="button"
                    onClick={toggleAssistant}
                    aria-pressed={voiceState === "listening"}
                    aria-label={`Voice Assistant: currently ${voiceState}. Press Alt+V to toggle`}
                    className={`relative flex items-center justify-center rounded-full px-3 py-1 font-semibold text-xs transition-all cursor-pointer ${
                      voiceState === "listening"
                        ? "bg-accent text-white shadow-xs font-bold"
                        : voiceState === "processing"
                        ? "bg-surface text-ink border border-ink/30 font-bold"
                        : voiceState === "speaking"
                        ? "bg-success text-white shadow-xs font-bold"
                        : "bg-bg text-ink hover:bg-bg/80 border border-ink/15"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      {/* Decorative motion indicators with aria-hidden */}
                      {voiceState === "processing" && (
                        <span className="relative flex h-2.5 w-2.5 items-center justify-center motion-reduce:hidden" aria-hidden="true">
                          <span className="absolute h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                          <span className="relative h-1.5 w-1.5 rounded-full bg-accent" />
                        </span>
                      )}

                      {voiceState === "listening" && (
                        <span className="relative flex h-2.5 w-2.5 items-center justify-center motion-reduce:hidden" aria-hidden="true">
                          <span
                            className="absolute rounded-full bg-white transition-transform duration-75"
                            style={{
                              transform: `scale(${1 + amplitude * 1.2})`,
                              opacity: 0.6 + amplitude * 0.4,
                              width: "10px",
                              height: "10px",
                            }}
                          />
                          <span className="relative h-1.5 w-1.5 rounded-full bg-white" />
                        </span>
                      )}

                      {voiceState !== "processing" && voiceState !== "listening" && (
                        <span
                          className={`inline-block h-1.5 w-1.5 rounded-full ${
                            voiceState === "speaking" ? "bg-white animate-pulse" : "bg-ink/40"
                          }`}
                          aria-hidden="true"
                        />
                      )}

                      <span>
                        {voiceState === "listening"
                          ? "Listening"
                          : voiceState === "processing"
                          ? "Processing…"
                          : voiceState === "speaking"
                          ? "Speaking"
                          : "Voice"}
                      </span>
                    </span>
                  </button>

                  {/* Audio Amplitude Level (decorative) */}
                  <div
                    className="flex items-end gap-0.5 h-4 w-10 px-1 py-0.5 rounded-full bg-bg border border-ink/15"
                    aria-hidden="true"
                    title={`Microphone input level: ${Math.round(amplitude * 100)}%`}
                  >
                    {[0.2, 0.4, 0.6, 0.8, 1.0].map((threshold, idx) => {
                      const isActive = amplitude >= threshold || (voiceState === "listening" && idx === 0);
                      return (
                        <div
                          key={idx}
                          className={`w-1 rounded-t transition-all duration-75 ${
                            isActive ? (idx >= 3 ? "bg-accent" : "bg-success") : "bg-ink/15"
                          }`}
                          style={{
                            height: isActive ? `${Math.max(25, amplitude * 100)}%` : "20%",
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-bg border border-ink/15 text-xs font-semibold text-ink shrink-0">
                  <span>Captions Mode (Text Only)</span>
                </div>
              )}

              {/* Middle: Synchronized Live Captions */}
              <div
                className="flex-1 min-w-[120px] overflow-hidden rounded-full bg-bg px-3 py-1 border border-ink/15"
                role="status"
                aria-live="polite"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-accent shrink-0">
                    {speakerLabel}:
                  </span>
                  <p className="truncate font-medium text-ink text-xs">
                    {liveCaption || (
                      <span className="italic text-ink/50">
                        {isDeafProfile
                          ? "Live captions ready."
                          : "Press Alt+V or speak your command..."}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Right: Settings & Minimize Controls */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setSettingsOpen(!settingsOpen)}
                  aria-expanded={settingsOpen}
                  aria-controls="accessibility-settings-panel"
                  aria-label="Open Accessibility Settings"
                  className="rounded-full border border-ink/15 bg-bg px-2.5 py-1 text-xs font-medium text-ink hover:bg-surface transition-colors cursor-pointer"
                  title="Accessibility settings"
                >
                  Settings
                </button>

                <button
                  type="button"
                  onClick={() => setMinimized(true)}
                  aria-label="Minimize Controls Bar"
                  className="rounded-full border border-ink/15 bg-bg px-2 py-1 text-xs font-medium text-ink/70 hover:bg-surface hover:text-ink transition-colors cursor-pointer"
                  title="Minimize bar"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Expandable Accessibility Settings Panel */}
            {settingsOpen && (
              <div
                id="accessibility-settings-panel"
                ref={settingsPanelRef}
                role="dialog"
                aria-label="Accessibility Settings"
                className="mt-2.5 border-t border-ink/10 pt-2.5 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs"
              >
                {/* Profile Choice */}
                <div className="flex flex-col gap-1 sm:col-span-3 border-b border-ink/10 pb-2.5">
                  <span className="text-[10px] font-bold text-accent uppercase tracking-wider">
                    Accessibility Profile
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-0.5">
                    <button
                      type="button"
                      onClick={() => setAccessibilityProfile("blind_low_vision")}
                      className={`p-2 rounded-xl border text-left text-xs transition-colors cursor-pointer ${
                        accessibilityProfile === "blind_low_vision"
                          ? "border-accent bg-bg font-bold shadow-xs"
                          : "border-ink/15 bg-bg/50 text-ink/80 hover:border-accent/40"
                      }`}
                    >
                      <div className="font-semibold text-ink">Blind / Low Vision</div>
                      <div className="text-[10px] text-ink/60 mt-0.5">Ambient voice &amp; full TTS</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAccessibilityProfile("deaf_hard_of_hearing")}
                      className={`p-2 rounded-xl border text-left text-xs transition-colors cursor-pointer ${
                        accessibilityProfile === "deaf_hard_of_hearing"
                          ? "border-accent bg-bg font-bold shadow-xs"
                          : "border-ink/15 bg-bg/50 text-ink/80 hover:border-accent/40"
                      }`}
                    >
                      <div className="font-semibold text-ink">Deaf / Hard of Hearing</div>
                      <div className="text-[10px] text-ink/60 mt-0.5">Zero mic access &amp; text only</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAccessibilityProfile("standard")}
                      className={`p-2 rounded-xl border text-left text-xs transition-colors cursor-pointer ${
                        accessibilityProfile === "standard"
                          ? "border-accent bg-bg font-bold shadow-xs"
                          : "border-ink/15 bg-bg/50 text-ink/80 hover:border-accent/40"
                      }`}
                    >
                      <div className="font-semibold text-ink">Standard</div>
                      <div className="text-[10px] text-ink/60 mt-0.5">Voice off by default</div>
                    </button>
                  </div>
                </div>

                {/* High Contrast Mode */}
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-ink">High Contrast</span>
                  <button
                    type="button"
                    onClick={() => setSettings((s) => ({ ...s, highContrast: !s.highContrast }))}
                    aria-pressed={settings.highContrast}
                    className={`rounded-lg py-1 px-2.5 text-xs font-medium border text-left transition-colors cursor-pointer ${
                      settings.highContrast
                        ? "border-accent bg-accent text-white font-bold"
                        : "border-ink/15 bg-bg text-ink"
                    }`}
                  >
                    {settings.highContrast ? "Enabled" : "Default"}
                  </button>
                </div>

                {/* Sound Effects */}
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-ink">Audio Cues</span>
                  <button
                    type="button"
                    onClick={() => setSettings((s) => ({ ...s, soundEffects: !s.soundEffects }))}
                    aria-pressed={settings.soundEffects}
                    className={`rounded-lg py-1 px-2.5 text-xs font-medium border text-left transition-colors cursor-pointer ${
                      settings.soundEffects
                        ? "border-accent bg-accent text-white font-bold"
                        : "border-ink/15 bg-bg text-ink"
                    }`}
                  >
                    {settings.soundEffects ? "Chimes On" : "Muted"}
                  </button>
                </div>

                {/* Caption Sizing */}
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-ink">Caption Size</span>
                  <select
                    value={settings.captionSize}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, captionSize: e.target.value as any }))
                    }
                    className="rounded-lg border border-ink/15 bg-bg px-2 py-1 text-xs text-ink focus:outline-none focus:border-accent cursor-pointer"
                  >
                    <option value="normal">Normal</option>
                    <option value="large">Large</option>
                    <option value="xlarge">Extra Large</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </aside>
      )}
    </>
  );
}
