"use client";

/**
 * VoiceContext.tsx — the single, persistent, site-wide voice command layer.
 *
 * Lifecycle (overhaul requirement #1):
 *   - Mounted once in the root layout, ABOVE the router/page, so it never
 *     unmounts on client-side view transitions and never re-requests the mic.
 *   - One `SpeechRecognition` instance (via `useVoiceCommand`). While it runs it
 *     holds the shared `commandBarActive` lock, so every other recogniser in the
 *     app (assistant chat, practice, the login form-filler) parks and instead
 *     consumes the transcript we broadcast on `careerforge:voice-transcript`.
 *   - Auto-starts once the activation probe (GlobalVoiceProvider) has resolved to
 *     voice mode; stays listening across the whole session.
 *
 * Intent pipeline (requirement #2):
 *   transcript → parseVoiceCommand →
 *     { kind: "navigate" } → speak + aria-live assertive ack, router nav, move
 *                            focus to the new view's <h1>/<main>
 *     { kind: "assistant" } → POST /api/assistant/chat, act on any resolved
 *                             route, speak the reply
 *   A transcript typed into a focused field is left for the form-filler.
 *
 * Login fallback (requirement #3): while signed out, 3 consecutive 5s windows
 * with no recognised speech → release the mic, announce, hand off to text.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useVoiceCommand, type UseVoiceCommandReturn } from "@/hooks/useVoiceCommand";
import { useApp } from "@/lib/store";
import { useGlobalVoice } from "@/providers/GlobalVoiceProvider";
import { setCommandBarActive, speakText, playAccessibleChime } from "@/lib/voice";
import { parseVoiceCommand, type VoiceCommand } from "@/lib/voiceCommands";
import type { FeatureId, ResumeTab } from "@/lib/intent";

interface VoiceContextValue {
  isSupported: boolean;
  /** True from the moment listening is requested (auto or manual) until stopped. */
  isActive: boolean;
  /** True only while the browser recognizer is actually capturing audio. */
  isListening: boolean;
  /** Latest recognized speech (final + interim). */
  transcript: string;
  /** Human-readable label of the last command we routed, or null. */
  lastCommand: string | null;
  /** Latest screen-reader / status line message. */
  statusMessage: string | null;
  startListening: () => void;
  stopListening: () => void;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

export function useVoice(): VoiceContextValue {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error("useVoice must be used within a VoiceProvider");
  return ctx;
}

const SILENCE_WINDOW_MS = 5000;
const SILENCE_WINDOWS_BEFORE_FALLBACK = 3;

/** Fire the app's existing in-page navigation event (see app/page.tsx). */
function navigate(feature: FeatureId | "assistant", resumeTab?: ResumeTab) {
  window.dispatchEvent(
    new CustomEvent("careerforge:navigate", { detail: { feature, resumeTab } })
  );
}

/** Is the user currently typing/dictating into a form field? */
function isEditingField(): boolean {
  const el = typeof document !== "undefined" ? document.activeElement : null;
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  );
}

/**
 * Move keyboard + screen-reader focus to the primary heading (or main landmark)
 * of the freshly rendered view. Never traps focus — the target only gets a
 * roving `tabindex="-1"` so it can receive programmatic focus once.
 */
function focusPrimaryHeading() {
  const attempt = (tries: number) => {
    const target = document.querySelector<HTMLElement>(
      "main h1, [role='main'] h1, main, [role='main'], h1"
    );
    if (!target) {
      if (tries > 0) setTimeout(() => attempt(tries - 1), 120);
      return;
    }
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    try {
      target.focus();
    } catch {
      /* focus can throw on nodes detached mid-transition */
    }
    target.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  // let page.tsx swap the view (synchronous setState) before we grab focus
  setTimeout(() => attempt(4), 200);
}

export function VoiceProvider({ children }: { children: ReactNode }) {
  const {
    user,
    voiceLanguage,
    userSkills,
    missingSkills,
    currentLocation,
    accessibilityPrefs,
  } = useApp();
  const { isPreferenceLoading, isVoiceMode, switchToTextMode } = useGlobalVoice();

  const [active, setActive] = useState(false);
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [politeMessage, setPoliteMessage] = useState<string | null>(null);
  const [assertiveMessage, setAssertiveMessage] = useState<string | null>(null);

  const speechEnabled = accessibilityPrefs?.speechOutput !== false;
  const lang = voiceLanguage && voiceLanguage !== "auto" ? voiceLanguage : "en-US";

  /** Latest hook return, so callbacks can start/stop without re-subscribing. */
  const voiceRef = useRef<UseVoiceCommandReturn | null>(null);
  const userStoppedRef = useRef(false);
  const fallbackFiredRef = useRef(false);
  /** Current section, tracked from the nav event so we can tell the assistant where we are. */
  const currentPageRef = useRef<FeatureId | "assistant">("assistant");
  /** Set on ANY recognised speech; polled + cleared by the login silence timer. */
  const heardSinceTickRef = useRef(false);

  // ── Screen-reader announcements ────────────────────────────────────────────
  const announce = useCallback(
    (message: string, urgency: "polite" | "assertive" = "polite") => {
      const set = urgency === "assertive" ? setAssertiveMessage : setPoliteMessage;
      set(null); // clear so an identical repeat still fires
      requestAnimationFrame(() => set(message));
    },
    []
  );

  const say = useCallback(
    (message: string, urgency: "polite" | "assertive" = "polite") => {
      announce(message, urgency);
      if (speechEnabled) {
        speakText(message, { lang: voiceLanguage && voiceLanguage !== "auto" ? voiceLanguage : undefined });
      }
    },
    [announce, speechEnabled, voiceLanguage]
  );

  // ── Login silence fallback (requirement #3) ───────────────────────────────
  const triggerLoginFallback = useCallback(() => {
    if (fallbackFiredRef.current) return;
    fallbackFiredRef.current = true;
    userStoppedRef.current = true;
    setActive(false);
    voiceRef.current?.stop(); // releases the media stream tracks
    setCommandBarActive(false);

    say("Voice input timed out. Switched to standard text input.", "assertive");
    switchToTextMode();

    setTimeout(() => {
      const field = document.querySelector<HTMLInputElement>(
        "#auth-email-input, input[type='email'], #auth-name-input, form input[type='text']"
      );
      field?.focus();
    }, 150);
  }, [say, switchToTextMode]);

  // ── AI assistant handoff (requirement #2) ─────────────────────────────────
  const askAssistant = useCallback(
    async (query: string) => {
      announce("Thinking…", "polite");
      try {
        const res = await fetch("/api/assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", text: query }],
            userProfile: {
              name: user?.name,
              email: user?.email,
              targetRole: user?.targetRole || undefined,
              skills: userSkills,
              missingSkills,
              location: currentLocation || undefined,
            },
            voiceMode: true,
            currentPage: currentPageRef.current,
            accessibilityPrefs,
          }),
        });
        const data = await res.json();
        const reply: string = data?.reply || "";
        const feature: (FeatureId | "assistant") | null = data?.feature ?? null;

        if (feature) {
          const dest = feature === "assistant" ? "Home" : feature;
          say(`Navigating to ${dest}.`, "assertive");
          navigate(feature, data?.resumeTab);
          setLastCommand(data?.featureTitle ?? String(dest));
          focusPrimaryHeading();
          if (reply) announce(reply, "polite");
          return;
        }

        if (reply) {
          say(reply, "polite");
          setLastCommand("Assistant");
        }
      } catch (err) {
        console.warn("[VoiceContext] assistant handoff failed:", err);
        say("Sorry, I could not reach the assistant. Please try again.", "assertive");
      }
    },
    [announce, say, user, userSkills, missingSkills, currentLocation, accessibilityPrefs]
  );

  // ── Route one final transcript ───────────────────────────────────────────
  const routeCommand = useCallback(
    (spoken: string) => {
      const text = spoken.trim();
      if (!text) return;
      heardSinceTickRef.current = true;

      // Broadcast for the parked recognisers (login form-filler, chat, practice).
      window.dispatchEvent(
        new CustomEvent("careerforge:voice-transcript", {
          detail: { text, isFinal: true },
        })
      );

      // A field is focused → this is dictation, not a command. Leave it.
      if (isEditingField()) return;

      const command: VoiceCommand | null = parseVoiceCommand(text);
      if (!command) return;

      if (command.kind === "assistant") {
        void askAssistant(command.query);
        return;
      }

      playAccessibleChime("navigate");
      say(`Navigating to ${command.label}.`, "assertive");
      navigate(command.feature, command.resumeTab);
      setLastCommand(command.label);

      const followUp = command.action;
      if (followUp) {
        setTimeout(
          () =>
            window.dispatchEvent(
              new CustomEvent("careerforge:action", { detail: { action: followUp } })
            ),
          300
        );
      }
      focusPrimaryHeading();
    },
    [askAssistant, say]
  );

  const voice = useVoiceCommand({
    enabled: active,
    ownsCommandBar: true,
    lang,
    onResult: routeCommand,
    onInterim: (t) => {
      heardSinceTickRef.current = true;
      window.dispatchEvent(
        new CustomEvent("careerforge:voice-transcript", { detail: { text: t, isFinal: false } })
      );
    },
    onSpeechDetected: () => {
      heardSinceTickRef.current = true;
    },
    onFallbackTriggered: () => {
      if (!user) triggerLoginFallback();
      else setActive(false);
    },
  });

  useEffect(() => {
    voiceRef.current = voice;
  });

  // 3 consecutive 5s windows of silence while signed out → text fallback.
  useEffect(() => {
    if (user || !active) return;
    let misses = 0;
    heardSinceTickRef.current = false;
    const id = setInterval(() => {
      if (heardSinceTickRef.current) {
        heardSinceTickRef.current = false;
        misses = 0;
        return;
      }
      misses += 1;
      if (misses >= SILENCE_WINDOWS_BEFORE_FALLBACK) {
        clearInterval(id);
        triggerLoginFallback();
      }
    }, SILENCE_WINDOW_MS);
    return () => clearInterval(id);
  }, [user, active, triggerLoginFallback]);

  // Signing in clears the login-only fallback latch.
  useEffect(() => {
    if (user) fallbackFiredRef.current = false;
  }, [user]);

  // However text mode is reached while signed out — our 5s timer above, the
  // activation probe's own silent-strike count, or a manual opt-out — deliver
  // the requirement-#3 hand-off: announce, then focus the first login field.
  useEffect(() => {
    if (user || isPreferenceLoading || isVoiceMode || fallbackFiredRef.current) return;
    fallbackFiredRef.current = true;
    say("Voice input timed out. Switched to standard text input.", "assertive");
    setTimeout(() => {
      document
        .querySelector<HTMLInputElement>(
          "#auth-email-input, input[type='email'], #auth-name-input, form input[type='text']"
        )
        ?.focus();
    }, 150);
  }, [user, isPreferenceLoading, isVoiceMode, say]);

  // A feature's mic button asks the one recogniser to (re)start.
  useEffect(() => {
    const onReq = () => {
      userStoppedRef.current = false;
      fallbackFiredRef.current = false;
      setActive(true);
    };
    window.addEventListener("careerforge:voice-request-start", onReq);
    return () => window.removeEventListener("careerforge:voice-request-start", onReq);
  }, []);

  // ── Track the active section for assistant context ────────────────────────
  useEffect(() => {
    const onNav = (e: Event) => {
      const detail = (e as CustomEvent<{ feature?: FeatureId | "assistant" }>).detail;
      if (detail?.feature) currentPageRef.current = detail.feature;
    };
    window.addEventListener("careerforge:navigate", onNav);
    return () => window.removeEventListener("careerforge:navigate", onNav);
  }, []);

  // ── Persistent auto-start once the activation probe resolves ──────────────
  useEffect(() => {
    if (isPreferenceLoading) return;
    if (isVoiceMode && voice.isSupported && !userStoppedRef.current) {
      setActive(true);
    } else if (!isVoiceMode) {
      setActive(false);
    }
  }, [isPreferenceLoading, isVoiceMode, voice.isSupported]);

  // ── Drive the recognizer + shared mic lock off `active` ───────────────────
  useEffect(() => {
    setCommandBarActive(active);
    if (active) {
      fallbackFiredRef.current = false;
      voiceRef.current?.resetStrikes();
      voiceRef.current?.start();
    } else {
      voiceRef.current?.stop();
    }
  }, [active]);

  // Release the shared mic lock if this provider ever unmounts.
  useEffect(() => () => setCommandBarActive(false), []);

  const value = useMemo<VoiceContextValue>(
    () => ({
      isSupported: voice.isSupported,
      isActive: active,
      isListening: voice.isListening,
      transcript: [voice.transcript, voice.interimTranscript].filter(Boolean).join(" ").trim(),
      lastCommand,
      statusMessage: assertiveMessage || politeMessage,
      startListening: () => {
        userStoppedRef.current = false;
        fallbackFiredRef.current = false;
        setActive(true);
      },
      stopListening: () => {
        userStoppedRef.current = true;
        setActive(false);
      },
    }),
    [
      voice.isSupported,
      active,
      voice.isListening,
      voice.transcript,
      voice.interimTranscript,
      lastCommand,
      assertiveMessage,
      politeMessage,
    ]
  );

  return (
    <VoiceContext.Provider value={value}>
      {children}
      {/* Screen-reader live regions — always in the DOM, updated in place. */}
      <div aria-live="polite" aria-atomic="true" className="sr-only" role="status">
        {politeMessage}
      </div>
      <div aria-live="assertive" aria-atomic="true" className="sr-only" role="alert">
        {assertiveMessage}
      </div>
    </VoiceContext.Provider>
  );
}
