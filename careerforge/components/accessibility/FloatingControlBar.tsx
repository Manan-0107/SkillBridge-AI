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

      {/* Main Persistent Accessible Control Bar */}
      <section
        id="voice-assistant-controls"
        role="region"
        aria-label="Accessibility and Voice Assistant Controls"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[94vw] max-w-4xl transition-all duration-300"
      >
        {/* Permission Denied Dismissible Notice */}
        {permissionBlockedNotice && (
          <div
            role="alert"
            className="mb-2 flex items-center justify-between rounded-xl border border-amber-500/50 bg-neutral-900 px-4 py-2 text-xs text-amber-300 shadow-lg"
          >
            <span>
              Microphone access is blocked in your browser settings. To use voice navigation, please enable microphone permission for this site.
            </span>
            <button
              type="button"
              onClick={() => setPermissionBlockedNotice(false)}
              className="ml-3 rounded font-bold hover:text-white"
            >
              ✕
            </button>
          </div>
        )}

        <div className="rounded-2xl border-2 border-neutral-700 bg-neutral-900/95 p-3 sm:p-4 text-white shadow-2xl backdrop-blur-md">
          {/* Top Row: State Pill, Visual Amplitude Meter, Live Captions, Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Left: State Pill & Audio Amplitude Meter (Completely unmounted for deaf profile) */}
            {!isDeafProfile ? (
              <div className="flex items-center gap-3">
                {/* Mic Toggle Button */}
                <button
                  ref={micButtonRef}
                  type="button"
                  onClick={toggleAssistant}
                  aria-pressed={voiceState === "listening"}
                  aria-label={`Voice Assistant: currently ${voiceState}. Press Alt+V to toggle`}
                  className={`relative flex items-center justify-center rounded-xl px-4 py-2.5 font-semibold text-sm transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-400 ${
                    voiceState === "listening"
                      ? "bg-amber-500 text-black shadow-lg shadow-amber-500/40 animate-pulse"
                      : voiceState === "speaking"
                      ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/40"
                      : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700 hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${
                        voiceState === "listening"
                          ? "bg-black animate-ping"
                          : voiceState === "speaking"
                          ? "bg-black"
                          : "bg-neutral-400"
                      }`}
                      aria-hidden="true"
                    />
                    <span>
                      {voiceState === "listening"
                        ? "Listening"
                        : voiceState === "processing"
                        ? "Thinking..."
                        : voiceState === "speaking"
                        ? "Speaking"
                        : "Voice Assistant"}
                    </span>
                  </span>
                </button>

                {/* Real-time Audio Amplitude Meter */}
                <div
                  className="flex items-end gap-1 h-6 w-16 px-1 py-1 rounded bg-neutral-800/80 border border-neutral-700"
                  aria-hidden="true"
                  title={`Microphone input level: ${Math.round(amplitude * 100)}%`}
                >
                  {[0.2, 0.4, 0.6, 0.8, 1.0].map((threshold, idx) => {
                    const isActive = amplitude >= threshold || (voiceState === "listening" && idx === 0);
                    return (
                      <div
                        key={idx}
                        className={`w-2 rounded-t transition-all duration-75 ${
                          isActive
                            ? idx >= 3
                              ? "bg-amber-400"
                              : "bg-emerald-400"
                            : "bg-neutral-700"
                        }`}
                        style={{
                          height: isActive ? `${Math.max(20, amplitude * 100)}%` : "15%",
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-800 border border-neutral-700 text-xs font-semibold text-neutral-300">
                <span aria-hidden="true">🦻</span>
                <span>Visual / Captions Mode (Mic Inactive)</span>
              </div>
            )}

            {/* Middle: Live Synchronized Captions (Mandatory for deaf / hard of hearing) */}
            <div
              className="flex-1 min-w-[200px] overflow-hidden rounded-lg bg-black/50 px-3 py-2 border border-neutral-800"
              role="status"
              aria-live="polite"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  {speakerLabel}:
                </span>
                <p className={`truncate font-medium text-neutral-100 ${captionSizeClass}`}>
                  {liveCaption || (
                    <span className="italic text-neutral-400">
                      {isDeafProfile
                        ? "Live captions will appear here."
                        : "Press Alt+V or click Voice Assistant to speak..."}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Right: Accessibility Settings Drawer Toggle */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSettingsOpen(!settingsOpen)}
                aria-expanded={settingsOpen}
                aria-controls="accessibility-settings-panel"
                aria-label="Open Accessibility and Display Settings"
                className="rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2 text-xs font-semibold text-neutral-200 hover:bg-neutral-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                ⚙ Settings
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
              className="mt-4 border-t border-neutral-800 pt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4"
            >
              {/* Accessibility Profile Switcher */}
              <div className="flex flex-col gap-1.5 sm:col-span-2 md:col-span-4 border-b border-neutral-800 pb-3">
                <label className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  Active Accessibility Profile
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setAccessibilityProfile("blind_low_vision")}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-colors ${
                      accessibilityProfile === "blind_low_vision"
                        ? "border-amber-400 bg-amber-500/20 text-white font-bold"
                        : "border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-600"
                    }`}
                  >
                    <div className="font-semibold">👁️ Blind / Low Vision</div>
                    <div className="text-[11px] text-neutral-400 mt-0.5">Always-on voice & TTS</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAccessibilityProfile("deaf_hard_of_hearing")}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-colors ${
                      accessibilityProfile === "deaf_hard_of_hearing"
                        ? "border-amber-400 bg-amber-500/20 text-white font-bold"
                        : "border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-600"
                    }`}
                  >
                    <div className="font-semibold">🦻 Deaf / Hard of Hearing</div>
                    <div className="text-[11px] text-neutral-400 mt-0.5">Zero mic access & captions</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAccessibilityProfile("standard")}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-colors ${
                      accessibilityProfile === "standard"
                        ? "border-amber-400 bg-amber-500/20 text-white font-bold"
                        : "border-neutral-700 bg-neutral-800 text-neutral-300 hover:border-neutral-600"
                    }`}
                  >
                    <div className="font-semibold">💻 Standard Experience</div>
                    <div className="text-[11px] text-neutral-400 mt-0.5">Voice off by default</div>
                  </button>
                </div>
              </div>

              {/* High Contrast Mode */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="high-contrast-toggle" className="text-xs font-semibold text-neutral-300">
                  High Contrast
                </label>
                <button
                  id="high-contrast-toggle"
                  type="button"
                  onClick={() => setSettings((s) => ({ ...s, highContrast: !s.highContrast }))}
                  aria-pressed={settings.highContrast}
                  className={`rounded-lg py-1.5 px-3 text-xs font-medium border text-left transition-colors ${
                    settings.highContrast
                      ? "border-amber-400 bg-amber-500/20 text-amber-300"
                      : "border-neutral-700 bg-neutral-800 text-neutral-300"
                  }`}
                >
                  {settings.highContrast ? "✓ High Contrast (ON)" : "Standard Contrast"}
                </button>
              </div>

              {/* Text Zoom / Size */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="font-size-select" className="text-xs font-semibold text-neutral-300">
                  Text Scale
                </label>
                <select
                  id="font-size-select"
                  value={settings.fontSizeMultiplier}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, fontSizeMultiplier: parseFloat(e.target.value) }))
                  }
                  className="rounded-lg border border-neutral-700 bg-neutral-800 py-1.5 px-2 text-xs text-neutral-200 focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <option value={1.0}>100% (Default)</option>
                  <option value={1.25}>125% (Large)</option>
                  <option value={1.5}>150% (Extra Large)</option>
                </select>
              </div>

              {/* Speech Speed */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="speech-rate-select" className="text-xs font-semibold text-neutral-300">
                  Assistant Speech Speed
                </label>
                <select
                  id="speech-rate-select"
                  value={settings.speechRate}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, speechRate: parseFloat(e.target.value) }))
                  }
                  className="rounded-lg border border-neutral-700 bg-neutral-800 py-1.5 px-2 text-xs text-neutral-200 focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <option value={0.85}>0.85x (Slower)</option>
                  <option value={1.0}>1.0x (Standard)</option>
                  <option value={1.2}>1.2x (Fast)</option>
                  <option value={1.4}>1.4x (Screen Reader Fast)</option>
                </select>
              </div>

              {/* Caption Size */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="caption-size-select" className="text-xs font-semibold text-neutral-300">
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
                  className="rounded-lg border border-neutral-700 bg-neutral-800 py-1.5 px-2 text-xs text-neutral-200 focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <option value="normal">Normal Text</option>
                  <option value="large">Large Text</option>
                  <option value="xlarge">Extra Large Text</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
