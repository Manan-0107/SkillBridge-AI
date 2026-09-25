"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useApp, AccessibilityProfile } from "@/lib/store";
import { playAccessibleChime } from "@/lib/voice";

export type AssistantVoiceState = "idle" | "listening" | "processing" | "speaking" | "error";

interface AccessibilitySettings {
  highContrast: boolean;
  fontSizeMultiplier: number; // 1.0, 1.25, 1.5
  speechRate: number; // 0.8 to 1.4
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
  const [ariaAnnouncement, setAriaAnnouncement] = useState<string>("");
  const [permissionBlockedNotice, setPermissionBlockedNotice] = useState<boolean>(false);
  const [minimized, setMinimized] = useState<boolean>(false);

  const micButtonRef = useRef<HTMLButtonElement>(null);
  const settingsPanelRef = useRef<HTMLDivElement>(null);

  const isDeafProfile = accessibilityProfile === "deaf_hard_of_hearing";
  const isBlindProfile = accessibilityProfile === "blind_low_vision";

  // Check microphone permissions silently on load without prompting native dialog
  useEffect(() => {
    if (typeof window === "undefined" || isDeafProfile) return;

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: "microphone" as PermissionName })
        .then((permissionStatus) => {
          if (permissionStatus.state === "granted") {
            setVoiceConsentStatus("granted");
            setPermissionBlockedNotice(false);
            // If blind/low vision profile, auto-start ambient listening silently
            if (isBlindProfile) {
              window.dispatchEvent(new CustomEvent("careerforge:toggle-mic", { detail: { active: true } }));
            }
          } else if (permissionStatus.state === "denied") {
            setVoiceConsentStatus("denied");
          } else {
            // 'prompt'
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
        .catch(() => {
          // navigator.permissions not supported or query restricted
        });
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

  // Apply high contrast and font scaling to root document element
  useEffect(() => {
    const root = document.documentElement;
    if (settings.highContrast) {
      root.classList.add("high-contrast-mode");
    } else {
      root.classList.remove("high-contrast-mode");
    }
    root.style.fontSize = `${settings.fontSizeMultiplier * 100}%`;

    try {
      localStorage.setItem("careerforge_a11y_prefs", JSON.stringify(settings));
    } catch {}
  }, [settings]);

  // Global hotkey: Alt + V or Option + V toggles voice assistant (only if not deaf profile)
  useEffect(() => {
    if (isDeafProfile) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.altKey && (e.key === "v" || e.key === "V")) || (e.ctrlKey && e.shiftKey && e.key === "V")) {
        e.preventDefault();
        toggleAssistant();
      }
      if (e.key === "Escape" && settingsOpen) {
        setSettingsOpen(false);
        micButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [settingsOpen, voiceState, isDeafProfile]);

  // Listen to custom window events from voice pipeline
  useEffect(() => {
    const handleVoiceStateChange = (e: CustomEvent<{ state: AssistantVoiceState; message?: string }>) => {
      if (e.detail?.state) {
        setVoiceState(e.detail.state);
        if (e.detail.message) {
          announceToScreenReader(e.detail.message);
        }
      }
    };

    const handleCaptionUpdate = (e: CustomEvent<{ text: string; speaker?: string; isFinal?: boolean }>) => {
      if (e.detail) {
        setLiveCaption(e.detail.text);
        if (e.detail.speaker) {
          setSpeakerLabel(e.detail.speaker);
        }
        if (e.detail.text) {
          announceToScreenReader(`${e.detail.speaker || "Assistant"}: ${e.detail.text}`);
        }
      }
    };

    const handleAmplitude = (e: CustomEvent<{ level: number }>) => {
      if (typeof e.detail?.level === "number") {
        setAmplitude(Math.min(1, Math.max(0, e.detail.level)));
      }
    };

    window.addEventListener("careerforge:voice-state" as any, handleVoiceStateChange);
    window.addEventListener("careerforge:caption" as any, handleCaptionUpdate);
    window.addEventListener("careerforge:amplitude" as any, handleAmplitude);

    return () => {
      window.removeEventListener("careerforge:voice-state" as any, handleVoiceStateChange);
      window.removeEventListener("careerforge:caption" as any, handleCaptionUpdate);
      window.removeEventListener("careerforge:amplitude" as any, handleAmplitude);
    };
  }, [settings.soundEffects]);

  const announceToScreenReader = (msg: string) => {
    setAriaAnnouncement(msg);
  };

  const toggleAssistant = () => {
    if (isDeafProfile) return;

    if (voiceConsentStatus === "denied") {
      setPermissionBlockedNotice(true);
      return;
    }

    if (voiceState === "listening" || voiceState === "processing") {
      setVoiceState("idle");
      setLiveCaption("");
      if (settings.soundEffects) playAccessibleChime("stop");
      announceToScreenReader("Voice assistant stopped.");
      window.dispatchEvent(new CustomEvent("careerforge:toggle-mic", { detail: { active: false } }));
    } else {
      setVoiceState("listening");
      setSpeakerLabel("You");
      setLiveCaption("Listening... Speak your command or question.");
      if (settings.soundEffects) playAccessibleChime("start");
      announceToScreenReader("Voice assistant listening. Speak now.");
      window.dispatchEvent(new CustomEvent("careerforge:toggle-mic", { detail: { active: true } }));
    }
  };

  const captionSizeClass =
    settings.captionSize === "xlarge"
      ? "text-xl sm:text-2xl"
      : settings.captionSize === "large"
      ? "text-base sm:text-lg"
      : "text-sm sm:text-base";

  return (
    <>
      {/* Hidden ARIA Live Region for Screen Readers */}
      <div
        id="voice-assistant-announcer"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {ariaAnnouncement}
      </div>

      {/* Minimized Floating Orb (when user collapses the control bar) */}
      {minimized ? (
        <aside
          id="voice-assistant-controls"
          role="region"
          aria-label="Accessibility and Voice Assistant Controls"
          className="fixed bottom-4 right-4 z-50 animate-in fade-in zoom-in-95 duration-200"
        >
          <button
            type="button"
            onClick={() => setMinimized(false)}
            aria-label="Expand Voice and Accessibility Controls. Shortcut: Alt plus V"
            className="flex items-center gap-2.5 rounded-full border-2 border-accent/20 bg-surface px-4 py-2 text-xs font-semibold text-ink shadow-2xl backdrop-blur-xl hover:bg-surface/90 hover:border-accent transition-all cursor-pointer group"
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                voiceState === "listening"
                  ? "bg-accent animate-ping"
                  : voiceState === "speaking"
                  ? "bg-success animate-pulse"
                  : "bg-accent-soft"
              }`}
            />
            <span className="group-hover:text-accent transition-colors font-bold">Voice Assistant</span>
            <span className="text-[10px] text-ink/70 bg-bg px-1.5 py-0.5 rounded border border-ink/10 font-mono">
              Alt+V
            </span>
          </button>
        </aside>
      ) : (
        /* Main Persistent Accessible Floating Capsule Bar */
        <aside
          id="voice-assistant-controls"
          role="region"
          aria-label="Accessibility and Voice Assistant Controls"
          className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 w-[94vw] max-w-2xl transition-all duration-300"
        >
          {/* Permission Denied Notice */}
          {permissionBlockedNotice && (
            <div
              role="alert"
              className="mb-2 flex items-center justify-between rounded-xl border-2 border-danger/40 bg-surface px-4 py-2 text-xs text-danger font-medium shadow-lg backdrop-blur-md"
            >
              <span>
                Microphone access is blocked in your browser settings. Enable microphone permission in browser settings to speak.
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

          <div className="rounded-2xl sm:rounded-full border-2 border-ink/15 bg-surface/95 p-2 sm:px-3 sm:py-2 text-ink shadow-2xl shadow-ink/20 backdrop-blur-2xl">
            {/* Top Row: State Pill, Visual Amplitude Meter, Live Captions, Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
              {/* Left: State Pill & Audio Amplitude Meter (Completely unmounted for deaf profile) */}
              {!isDeafProfile ? (
                <div className="flex items-center gap-2">
                  {/* Mic Toggle Button */}
                  <button
                    ref={micButtonRef}
                    type="button"
                    onClick={toggleAssistant}
                    aria-pressed={voiceState === "listening"}
                    aria-label={`Voice Assistant: currently ${voiceState}. Press Alt+V to toggle`}
                    className={`relative flex items-center justify-center rounded-full px-3.5 py-1.5 font-semibold text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent cursor-pointer ${
                      voiceState === "listening"
                        ? "bg-accent text-white shadow-md font-bold"
                        : voiceState === "processing"
                        ? "bg-accent-soft text-white shadow-md font-bold"
                        : voiceState === "speaking"
                        ? "bg-success text-white shadow-md font-bold"
                        : "bg-bg/80 text-ink hover:bg-bg border border-ink/15"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {/* Section 2: Thinking Orbs for processing state */}
                      {voiceState === "processing" && (
                        <span className="relative flex h-3.5 w-3.5 items-center justify-center motion-reduce:hidden" aria-hidden="true">
                          <span className="absolute h-full w-full animate-ping rounded-full bg-white opacity-70" />
                          <span className="relative h-2 w-2 rounded-full bg-white animate-pulse" />
                        </span>
                      )}

                      {/* Section 2: Voice Glow Ring that expands with input volume for listening state */}
                      {voiceState === "listening" && (
                        <span className="relative flex h-3.5 w-3.5 items-center justify-center motion-reduce:hidden" aria-hidden="true">
                          <span
                            className="absolute rounded-full bg-white transition-transform duration-75"
                            style={{
                              transform: `scale(${1 + amplitude * 1.5})`,
                              opacity: 0.5 + amplitude * 0.5,
                              width: "12px",
                              height: "12px",
                            }}
                          />
                          <span className="relative h-2 w-2 rounded-full bg-white" />
                        </span>
                      )}

                      {/* Default idle dot */}
                      {voiceState !== "processing" && voiceState !== "listening" && (
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${
                            voiceState === "speaking" ? "bg-white animate-pulse" : "bg-accent"
                          }`}
                          aria-hidden="true"
                        />
                      )}

                      <span>
                        {voiceState === "listening"
                          ? "Listening"
                          : voiceState === "processing"
                          ? "Thinking…"
                          : voiceState === "speaking"
                          ? "Speaking"
                          : "Enable Voice"}
                      </span>
                    </span>
                  </button>

                  {/* Real-time Audio Amplitude Meter */}
                  <div
                    className="flex items-end gap-1 h-5 w-12 px-1 py-0.5 rounded-full bg-bg/90 border border-ink/15"
                    aria-hidden="true"
                    title={`Microphone input level: ${Math.round(amplitude * 100)}%`}
                  >
                    {[0.2, 0.4, 0.6, 0.8, 1.0].map((threshold, idx) => {
                      const isActive = amplitude >= threshold || (voiceState === "listening" && idx === 0);
                      return (
                        <div
                          key={idx}
                          className={`w-1.5 rounded-t transition-all duration-75 ${
                            isActive
                              ? idx >= 3
                                ? "bg-accent"
                                : "bg-success"
                              : "bg-ink/15"
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
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-bg/90 border border-ink/15 text-xs font-semibold text-ink">
                  <span aria-hidden="true">🦻</span>
                  <span>Captions Mode (Text Only)</span>
                </div>
              )}

              {/* Middle: Live Synchronized Captions */}
              <div
                className="flex-1 min-w-[140px] overflow-hidden rounded-full bg-bg/90 px-3 py-1 border border-ink/15"
                role="status"
                aria-live="polite"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-accent shrink-0">
                    {speakerLabel}:
                  </span>
                  <p className={`truncate font-medium text-ink text-xs ${captionSizeClass}`}>
                    {liveCaption || (
                      <span className="italic text-ink/60">
                        {isDeafProfile
                          ? "Synchronized live captions ready."
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
                  aria-label="Open Accessibility and Display Settings"
                  className="rounded-full border border-ink/15 bg-bg/80 px-2.5 py-1 text-xs font-medium text-ink hover:bg-bg transition-colors cursor-pointer"
                  title="Accessibility settings"
                >
                  ⚙
                </button>

                <button
                  type="button"
                  onClick={() => setMinimized(true)}
                  aria-label="Minimize Voice Assistant Bar"
                  className="rounded-full border border-ink/15 bg-bg/80 px-2 py-1 text-xs font-medium text-ink/70 hover:bg-bg hover:text-ink transition-colors cursor-pointer"
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
                className="mt-3 border-t border-ink/15 pt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs"
              >
                {/* Accessibility Profile Switcher */}
                <div className="flex flex-col gap-1 sm:col-span-2 md:col-span-4 border-b border-ink/15 pb-3">
                  <label className="text-[10px] font-bold text-accent uppercase tracking-wider">
                    Active Accessibility Profile
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setAccessibilityProfile("blind_low_vision")}
                      className={`p-2.5 rounded-xl border-2 text-left text-xs transition-colors cursor-pointer ${
                        accessibilityProfile === "blind_low_vision"
                          ? "border-accent bg-bg font-bold shadow-sm"
                          : "border-ink/15 bg-bg/50 text-ink/80 hover:border-accent/40"
                      }`}
                    >
                      <div className="font-semibold text-ink">👁️ Blind / Low Vision</div>
                      <div className="text-[10px] text-ink/70 mt-0.5">Ambient voice &amp; full TTS</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAccessibilityProfile("deaf_hard_of_hearing")}
                      className={`p-2.5 rounded-xl border-2 text-left text-xs transition-colors cursor-pointer ${
                        accessibilityProfile === "deaf_hard_of_hearing"
                          ? "border-accent bg-bg font-bold shadow-sm"
                          : "border-ink/15 bg-bg/50 text-ink/80 hover:border-accent/40"
                      }`}
                    >
                      <div className="font-semibold text-ink">🦻 Deaf / Hard of Hearing</div>
                      <div className="text-[10px] text-ink/70 mt-0.5">Zero mic access &amp; text captions</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAccessibilityProfile("standard")}
                      className={`p-2.5 rounded-xl border-2 text-left text-xs transition-colors cursor-pointer ${
                        accessibilityProfile === "standard"
                          ? "border-accent bg-bg font-bold shadow-sm"
                          : "border-ink/15 bg-bg/50 text-ink/80 hover:border-accent/40"
                      }`}
                    >
                      <div className="font-semibold text-ink">💻 Standard</div>
                      <div className="text-[10px] text-ink/70 mt-0.5">Voice off by default</div>
                    </button>
                  </div>
                </div>

                {/* High Contrast Mode */}
                <div className="flex flex-col gap-1">
                  <label htmlFor="high-contrast-toggle" className="text-[11px] font-semibold text-ink">
                    High Contrast
                  </label>
                  <button
                    id="high-contrast-toggle"
                    type="button"
                    onClick={() => setSettings((s) => ({ ...s, highContrast: !s.highContrast }))}
                    aria-pressed={settings.highContrast}
                    className={`rounded-lg py-1.5 px-3 text-xs font-medium border text-left transition-colors cursor-pointer ${
                      settings.highContrast
                        ? "border-accent bg-accent text-white font-bold"
                        : "border-ink/15 bg-bg/80 text-ink"
                    }`}
                  >
                    {settings.highContrast ? "✓ High Contrast (ON)" : "Standard Contrast"}
                  </button>
                </div>

                {/* Text Zoom / Size */}
                <div className="flex flex-col gap-1">
                  <label htmlFor="font-size-select" className="text-[11px] font-semibold text-ink">
                    Text Scale
                  </label>
                  <select
                    id="font-size-select"
                    value={settings.fontSizeMultiplier}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, fontSizeMultiplier: parseFloat(e.target.value) }))
                    }
                    className="rounded-lg border border-ink/15 bg-bg/90 py-1.5 px-2 text-xs text-ink focus-visible:ring-1 focus-visible:ring-accent"
                  >
                    <option value={1.0}>100% (Default)</option>
                    <option value={1.25}>125% (Large)</option>
                    <option value={1.5}>150% (Extra Large)</option>
                  </select>
                </div>

                {/* Speech Speed */}
                <div className="flex flex-col gap-1">
                  <label htmlFor="speech-rate-select" className="text-[11px] font-semibold text-ink">
                    Speech Speed
                  </label>
                  <select
                    id="speech-rate-select"
                    value={settings.speechRate}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, speechRate: parseFloat(e.target.value) }))
                    }
                    className="rounded-lg border border-ink/15 bg-bg/90 py-1.5 px-2 text-xs text-ink focus-visible:ring-1 focus-visible:ring-accent"
                  >
                    <option value={0.85}>0.85x (Slower)</option>
                    <option value={1.0}>1.0x (Standard)</option>
                    <option value={1.2}>1.2x (Fast)</option>
                    <option value={1.4}>1.4x (Screen Reader Fast)</option>
                  </select>
                </div>

                {/* Caption Size */}
                <div className="flex flex-col gap-1">
                  <label htmlFor="caption-size-select" className="text-[11px] font-semibold text-ink">
                    Captions Display
                  </label>
                  <select
                    id="caption-size-select"
                    value={settings.captionSize}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        captionSize: e.target.value as AccessibilitySettings["captionSize"],
                      }))
                    }
                    className="rounded-lg border border-ink/15 bg-bg/90 py-1.5 px-2 text-xs text-ink focus-visible:ring-1 focus-visible:ring-accent"
                  >
                    <option value="normal">Normal Text</option>
                    <option value="large">Large Text</option>
                    <option value="xlarge">Extra Large Text</option>
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
