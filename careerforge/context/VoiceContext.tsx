"use client";

/**
 * VoiceContext.tsx — global voice-command layer.
 *
 * Web Speech API handling (vendor prefixes, continuous listen, auto-restart,
 * 3-strike silence fallback) already lives in `@/hooks/useVoiceCommand`; this
 * provider reuses it and adds the command router on top.
 *
 * Routing: this project is a single page (`app/page.tsx`) whose sections are
 * switched via a `careerforge:navigate` window event, not real routes — so we
 * dispatch that event rather than calling `useRouter().push`. Swap `navigate()`
 * for the router if real route targets are ever added.
 *
 * This is the one mic the user explicitly controls. While it's listening it
 * calls `setCommandBarActive(true)` so the ambient probe / dictator recognizers
 * park and stop fighting it for the microphone.
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
import { useVoiceCommand } from "@/hooks/useVoiceCommand";
import { setCommandBarActive } from "@/lib/voice";
import { parseVoiceCommand } from "@/lib/voiceCommands";
import type { FeatureId, ResumeTab } from "@/lib/intent";

interface VoiceContextValue {
  isSupported: boolean;
  /** True from the moment START is pressed until STOP — the session the user asked for. */
  isActive: boolean;
  /** True only while the browser recognizer is actually capturing audio. */
  isListening: boolean;
  /** Latest recognized speech (final + interim). */
  transcript: string;
  /** Human-readable label of the last command we routed, or null. */
  lastCommand: string | null;
  startListening: () => void;
  stopListening: () => void;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

export function useVoice(): VoiceContextValue {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error("useVoice must be used within a VoiceProvider");
  return ctx;
}

/** Fire the app's existing in-page navigation event (see app/page.tsx). */
function navigate(feature: FeatureId | "assistant", resumeTab?: ResumeTab) {
  window.dispatchEvent(
    new CustomEvent("careerforge:navigate", { detail: { feature, resumeTab } })
  );
}

export function VoiceProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const [lastCommand, setLastCommand] = useState<string | null>(null);

  const routeCommand = useCallback((spoken: string) => {
    const command = parseVoiceCommand(spoken);
    console.log("[VoiceContext] heard:", JSON.stringify(spoken.trim()), "→", command?.label ?? "(no match)");
    if (!command) return;

    navigate(command.feature, command.resumeTab);
    const { action } = command;
    if (action) {
      // nav → mount → effect; a short delay lets the target subscribe first.
      setTimeout(
        () =>
          window.dispatchEvent(
            new CustomEvent("careerforge:action", { detail: { action } })
          ),
        300
      );
    }
    setLastCommand(command.label);
  }, []);

  const voice = useVoiceCommand({
    enabled: active,
    ownsCommandBar: true,
    onResult: routeCommand,
    onFallbackTriggered: () => setActive(false),
  });

  // `voice`'s identity changes every render; a ref lets the toggle effect call
  // the latest start/stop without re-running on each render.
  const voiceRef = useRef(voice);
  useEffect(() => {
    voiceRef.current = voice;
  });

  useEffect(() => {
    setCommandBarActive(active);
    if (active) {
      voiceRef.current.resetStrikes();
      voiceRef.current.start();
    } else {
      voiceRef.current.stop();
    }
  }, [active]);

  // Release the shared mic lock if this provider unmounts mid-session.
  useEffect(() => () => setCommandBarActive(false), []);

  const value = useMemo<VoiceContextValue>(
    () => ({
      isSupported: voice.isSupported,
      isActive: active,
      isListening: voice.isListening,
      transcript: [voice.transcript, voice.interimTranscript]
        .filter(Boolean)
        .join(" ")
        .trim(),
      lastCommand,
      startListening: () => setActive(true),
      stopListening: () => setActive(false),
    }),
    [
      voice.isSupported,
      active,
      voice.isListening,
      voice.transcript,
      voice.interimTranscript,
      lastCommand,
    ]
  );

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}
