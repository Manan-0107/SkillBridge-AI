"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useApp, AccessibilityProfile } from "@/lib/store";
import { playAccessibleChime } from "@/lib/voice";
import { Mic, MicOff, Settings, Minus, X, Volume2, Captions } from "lucide-react";

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
  const [captionVisible, setCaptionVisible] = useState<boolean>(false);

  const micButtonRef = useRef<HTMLButtonElement>(null);
  const settingsPanelRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const isDeafProfile = accessibilityProfile === "deaf_hard_of_hearing";
  const isBlindProfile = accessibilityProfile === "blind_low_vision";

  // Check microphone permissions silently on mount
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

  // Listen to voice and caption events
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
        setCaptionVisible(true);
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
      if (e.key === "Escape" && settingsOpen) {
        setSettingsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // Close settings panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        settingsOpen &&
        settingsPanelRef.current &&
        barRef.current &&
        !barRef.current.contains(e.target as Node)
      ) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [settingsOpen]);

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

  const voiceStateColor = {
    idle: "text-ink/50",
    listening: "text-accent",
    processing: "text-accent",
    speaking: "text-success",
    error: "text-danger",
  }[voiceState];

  const voiceStateBg = {
    idle: "bg-surface border-ink/12",
    listening: "bg-accent/10 border-accent/30",
    processing: "bg-accent/8 border-accent/20",
    speaking: "bg-success/10 border-success/30",
    error: "bg-danger/10 border-danger/30",
  }[voiceState];

  return (
    <>
      {/* Offscreen ARIA Live Region */}
      <div
        id="voice-assistant-announcer"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {liveCaption ? `${speakerLabel}: ${liveCaption}` : `Voice assistant is currently ${voiceState}.`}
      </div>

      {/* Live captions floating banner — shows when caption is active */}
      {captionVisible && liveCaption && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 max-w-lg w-[92vw] animate-fadeIn"
        >
          <div className="rounded-xl border border-ink/12 bg-bg/95 backdrop-blur-md px-4 py-2.5 shadow-lg shadow-ink/8">
            <div className="flex items-start gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-accent pt-0.5 shrink-0">
                {speakerLabel}
              </span>
              <p className="text-sm text-ink leading-snug">{liveCaption}</p>
              <button
                type="button"
                onClick={() => setCaptionVisible(false)}
                aria-label="Dismiss caption"
                className="ml-auto shrink-0 text-ink/30 hover:text-ink/70 transition-colors cursor-pointer"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Permission blocked notice */}
      {permissionBlockedNotice && (
        <div
          role="alert"
          className="fixed bottom-20 right-4 z-50 max-w-xs animate-fadeIn"
        >
          <div className="rounded-xl border border-danger/30 bg-bg/98 px-3 py-2.5 shadow-lg text-xs text-danger flex items-start gap-2">
            <span className="flex-1">Microphone blocked. Enable in browser settings to use voice.</span>
            <button
              type="button"
              onClick={() => setPermissionBlockedNotice(false)}
              aria-label="Dismiss"
              className="shrink-0 font-bold hover:text-ink cursor-pointer"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {/* ─── Main floating pill ─────────────────────────────── */}
      {minimized ? (
        <aside
          role="region"
          aria-label="Voice Assistant Controls (minimized)"
          className="fixed bottom-5 right-5 z-50"
        >
          <button
            type="button"
            onClick={() => setMinimized(false)}
            aria-label="Expand voice assistant controls"
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-md backdrop-blur-sm transition-all cursor-pointer ${voiceStateBg}`}
          >
            {!isDeafProfile && (
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  voiceState === "listening"
                    ? "bg-accent animate-pulse"
                    : voiceState === "speaking"
                    ? "bg-success animate-pulse"
                    : "bg-ink/30"
                }`}
                aria-hidden="true"
              />
            )}
            <span className={voiceStateColor}>
              {isDeafProfile ? "Captions" : "Voice"}
            </span>
            <span className="text-[9px] text-ink/40 font-mono border border-ink/10 rounded px-1 bg-bg/60">
              Alt+V
            </span>
          </button>
        </aside>
      ) : (
        <aside
          id="voice-assistant-controls"
          role="region"
          aria-label="Accessibility and Voice Assistant Controls"
          ref={barRef}
          className="fixed bottom-5 right-5 z-50"
        >
          {/* Settings popover */}
          {settingsOpen && (
            <div
              id="accessibility-settings-panel"
              ref={settingsPanelRef}
              role="dialog"
              aria-label="Accessibility Settings"
              className="absolute bottom-full right-0 mb-2 w-72 rounded-2xl border border-ink/12 bg-bg/98 shadow-xl shadow-ink/10 backdrop-blur-md p-4 animate-fadeIn"
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold text-ink tracking-tight">Accessibility Settings</h2>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  aria-label="Close settings"
                  className="text-ink/40 hover:text-ink transition-colors cursor-pointer"
                >
                  <X size={13} />
                </button>
              </div>

              {/* Profile Choice */}
              <div className="mb-3">
                <p className="text-[10px] font-bold text-accent uppercase tracking-widest mb-1.5">
                  Accessibility Profile
                </p>
                <div className="flex flex-col gap-1.5">
                  {(["blind_low_vision", "deaf_hard_of_hearing", "standard"] as AccessibilityProfile[]).map(
                    (profile) => {
                      const labels: Record<AccessibilityProfile, { title: string; sub: string }> = {
                        blind_low_vision: { title: "Blind / Low Vision", sub: "Ambient voice & full TTS" },
                        deaf_hard_of_hearing: { title: "Deaf / Hard of Hearing", sub: "Zero mic, text only" },
                        standard: { title: "Standard", sub: "Voice off by default" },
                      };
                      const isSelected = accessibilityProfile === profile;
                      return (
                        <button
                          key={profile}
                          type="button"
                          onClick={() => setAccessibilityProfile(profile)}
                          className={`text-left rounded-xl border px-3 py-2 text-xs transition-all cursor-pointer ${
                            isSelected
                              ? "border-accent bg-accent/8 font-semibold"
                              : "border-ink/10 hover:border-ink/20 hover:bg-surface/50"
                          }`}
                        >
                          <div className="font-semibold text-ink">{labels[profile].title}</div>
                          <div className="text-[10px] text-ink/50 mt-0.5">{labels[profile].sub}</div>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              <div className="border-t border-ink/8 pt-3 grid grid-cols-2 gap-2">
                {/* High Contrast */}
                <div>
                  <p className="text-[10px] font-semibold text-ink/60 mb-1">High Contrast</p>
                  <button
                    type="button"
                    onClick={() => setSettings((s) => ({ ...s, highContrast: !s.highContrast }))}
                    aria-pressed={settings.highContrast}
                    className={`w-full rounded-lg border px-2 py-1 text-xs font-medium transition-colors cursor-pointer ${
                      settings.highContrast
                        ? "border-accent bg-accent text-white"
                        : "border-ink/12 bg-surface/60 text-ink/70 hover:border-ink/25"
                    }`}
                  >
                    {settings.highContrast ? "On" : "Off"}
                  </button>
                </div>

                {/* Audio Cues */}
                <div>
                  <p className="text-[10px] font-semibold text-ink/60 mb-1">Audio Cues</p>
                  <button
                    type="button"
                    onClick={() => setSettings((s) => ({ ...s, soundEffects: !s.soundEffects }))}
                    aria-pressed={settings.soundEffects}
                    className={`w-full rounded-lg border px-2 py-1 text-xs font-medium transition-colors cursor-pointer ${
                      settings.soundEffects
                        ? "border-accent bg-accent text-white"
                        : "border-ink/12 bg-surface/60 text-ink/70 hover:border-ink/25"
                    }`}
                  >
                    {settings.soundEffects ? "On" : "Off"}
                  </button>
                </div>

                {/* Caption Size */}
                <div className="col-span-2">
                  <p className="text-[10px] font-semibold text-ink/60 mb-1">Caption Size</p>
                  <select
                    value={settings.captionSize}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, captionSize: e.target.value as any }))
                    }
                    className="w-full rounded-lg border border-ink/12 bg-surface/60 px-2 py-1 text-xs text-ink focus:outline-none focus:border-accent cursor-pointer"
                  >
                    <option value="normal">Normal</option>
                    <option value="large">Large</option>
                    <option value="xlarge">Extra Large</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* The pill itself */}
          <div
            className={`flex items-center gap-1.5 rounded-full border px-2 py-1.5 shadow-lg shadow-ink/8 backdrop-blur-md transition-all duration-200 ${voiceStateBg}`}
          >
            {/* Mic button or deaf badge */}
            {!isDeafProfile ? (
              <button
                ref={micButtonRef}
                type="button"
                onClick={toggleAssistant}
                aria-pressed={voiceState === "listening"}
                aria-label={`Voice assistant: ${voiceState}. Press to ${voiceState === "listening" ? "stop" : "start"} listening. Shortcut: Alt+V`}
                className={`flex items-center justify-center h-7 w-7 rounded-full transition-all cursor-pointer ${
                  voiceState === "listening"
                    ? "bg-accent text-white shadow-sm"
                    : voiceState === "speaking"
                    ? "bg-success text-white shadow-sm"
                    : "bg-bg/80 text-ink/60 hover:text-ink border border-ink/10"
                }`}
              >
                {/* Mic animation for listening state */}
                {voiceState === "listening" ? (
                  <span className="relative flex items-center justify-center" aria-hidden="true">
                    <span className="absolute h-7 w-7 rounded-full bg-accent/30 animate-ping" />
                    <Mic size={13} strokeWidth={2.5} />
                  </span>
                ) : voiceState === "processing" ? (
                  <span className="relative flex items-center justify-center" aria-hidden="true">
                    <span className="absolute h-5 w-5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                  </span>
                ) : (
                  <Mic size={13} strokeWidth={2.5} aria-hidden="true" />
                )}
              </button>
            ) : (
              <div
                aria-label="Deaf/Hard of Hearing mode: captions only"
                className="flex items-center justify-center h-7 w-7 rounded-full bg-bg/80 border border-ink/10 text-ink/60"
              >
                <Captions size={13} strokeWidth={2} aria-hidden="true" />
              </div>
            )}

            {/* Amplitude bars — voice state indicator, decorative */}
            {!isDeafProfile && (
              <div
                className="flex items-end gap-[2px] h-4 w-7"
                aria-hidden="true"
                title={`Mic level: ${Math.round(amplitude * 100)}%`}
              >
                {[0.2, 0.5, 0.8, 0.5, 0.2].map((weight, idx) => {
                  const isActive = voiceState === "listening" && amplitude > 0;
                  const h = isActive ? Math.max(15, amplitude * weight * 100) : 15;
                  return (
                    <div
                      key={idx}
                      className={`w-[3px] rounded-full transition-all duration-75 ${
                        voiceState === "listening" ? "bg-accent/70" : "bg-ink/15"
                      }`}
                      style={{ height: `${h}%` }}
                    />
                  );
                })}
              </div>
            )}

            {/* Status label */}
            <span className={`text-[11px] font-medium px-1 ${voiceStateColor}`}>
              {voiceState === "listening"
                ? "Listening…"
                : voiceState === "processing"
                ? "Thinking…"
                : voiceState === "speaking"
                ? "Speaking"
                : isDeafProfile
                ? "Captions"
                : "Voice"}
            </span>

            {/* Divider */}
            <div className="w-px h-4 bg-ink/10 mx-0.5" aria-hidden="true" />

            {/* Settings button */}
            <button
              type="button"
              onClick={() => setSettingsOpen((o) => !o)}
              aria-expanded={settingsOpen}
              aria-controls="accessibility-settings-panel"
              aria-label="Accessibility settings"
              title="Accessibility settings"
              className="flex items-center justify-center h-7 w-7 rounded-full bg-bg/60 border border-ink/10 text-ink/50 hover:text-ink hover:border-ink/20 transition-colors cursor-pointer"
            >
              <Settings size={12} strokeWidth={2} aria-hidden="true" />
            </button>

            {/* Minimize button */}
            <button
              type="button"
              onClick={() => setMinimized(true)}
              aria-label="Minimize controls"
              title="Minimize"
              className="flex items-center justify-center h-7 w-7 rounded-full bg-bg/60 border border-ink/10 text-ink/40 hover:text-ink hover:border-ink/20 transition-colors cursor-pointer"
            >
              <Minus size={12} strokeWidth={2.5} aria-hidden="true" />
            </button>
          </div>
        </aside>
      )}
    </>
  );
}
