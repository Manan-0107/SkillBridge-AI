"use client";

/**
 * GlobalVoiceProvider.tsx
 *
 * Voice-first activation flow, run automatically on every home-page load —
 * no "click to talk" button gates it:
 *
 *   1. Mount → `isPreferenceLoading = true`. Nothing voice- or text-specific
 *      renders yet; consumers show a neutral loading placeholder.
 *   2. Check the stored DB preference (`GET /api/user/profile`). If the
 *      user has *already* permanently fallen back to text on a past visit,
 *      skip re-probing the mic entirely — jump straight to text mode. This
 *      is a deliberate deviation from re-testing on every load: repeatedly
 *      requesting mic access from someone who has already established they
 *      don't use voice is bad UX for the exact population this system is
 *      trying to serve. See note at bottom of file if you want this
 *      short-circuit removed.
 *   3. Otherwise, start `SpeechRecognition` immediately. Up to 3 attempts:
 *        - ANY recognized audio (interim or final) → `isVoiceMode = true`.
 *        - 3 consecutive no-speech/audio-capture failures → `isVoiceMode = false`.
 *   4. Only once step 2 or 3 resolves does `isPreferenceLoading` flip to
 *      `false` and the real UI (voice or text) appears.
 *
 * The outcome is persisted back to the DB (`PATCH /api/user/preferences`)
 * either way, so it's available as the fast-path check on the next visit
 * and stays in sync across devices.
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
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useApp } from "@/lib/store";
import { detectTextLanguage, setGlobalVoiceLanguage } from "@/lib/voice";

export const MAX_ACTIVATION_ATTEMPTS = 3;

interface UserProfileResponse {
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
    requiresTextFallback: boolean;
  };
}

/** Returns the stored preference, or `null` if unknown (logged out, network error, no row yet). */
async function fetchStoredPreference(): Promise<boolean | null> {
  try {
    const res = await fetch("/api/user/profile", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as UserProfileResponse;
    return data.user?.requiresTextFallback ?? null;
  } catch (error) {
    console.error("Failed to fetch voice preference:", error);
    return null;
  }
}

async function persistPreference(
  requiresTextFallback: boolean,
  attempt = 1
): Promise<boolean> {
  try {
    const res = await fetch("/api/user/preferences", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requiresTextFallback }),
    });
    if (!res.ok) throw new Error(`PATCH failed with status ${res.status}`);
    return true;
  } catch (error) {
    console.error(
      `Failed to persist voice preference (attempt ${attempt}):`,
      error
    );
    // One retry — worth a second attempt on a flaky connection, but not
    // worth retrying forever.
    if (attempt < 2) return persistPreference(requiresTextFallback, attempt + 1);
    return false;
  }
}

interface GlobalVoiceContextValue {
  isSupported: boolean;
  isListening: boolean;
  isRequestingPermission: boolean;
  hasRequestedPermission: boolean;
  /** True while the activation probe (DB check + up-to-3 mic attempts) is still deciding voice vs. text. */
  isPreferenceLoading: boolean;
  transcript: string;
  interimTranscript: string;
  /** How many of the 3 activation attempts have failed so far, during the probe. */
  attemptsFailed: number;
  maxAttempts: number;
  /** True once the probe (or a manual choice) has settled on voice input. */
  isVoiceMode: boolean;
  /** Convenience alias — `!isVoiceMode`. Kept for components built against the older naming. */
  isTextFallbackMode: boolean;
  permissionDenied: boolean;
  /** True if the most recent write to the server failed after retrying. */
  syncError: boolean;
  /** Manually (re-)request mic access, e.g. a paused-mic recovery affordance — not used for initial activation. */
  requestVoiceStart: () => void;
  /** Re-run the 3-attempt probe from a user-initiated "try voice again" action, bypassing the stored-preference short-circuit. */
  retryVoiceMode: () => void;
  /** Manually opt out of voice mode, e.g. a "use text instead" control. */
  switchToTextMode: () => void;
}

const GlobalVoiceContext = createContext<GlobalVoiceContextValue | null>(null);

export function useGlobalVoice(): GlobalVoiceContextValue {
  const ctx = useContext(GlobalVoiceContext);
  if (!ctx) {
    throw new Error("useGlobalVoice must be used within a GlobalVoiceProvider");
  }
  return ctx;
}

export function GlobalVoiceProvider({ children }: { children: ReactNode }) {
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isPreferenceLoading, setIsPreferenceLoading] = useState(true);
  const [hasRequestedPermission, setHasRequestedPermission] = useState(false);
  const [syncError, setSyncError] = useState(false);

  const supabaseRef = useRef(createSupabaseBrowserClient());
  /** Guards a single probe cycle from resolving twice (e.g. a late error arriving after speech was already detected). */
  const probeResolvedRef = useRef(false);
  /** Lets callbacks call the latest start/stop/resetStrikes without depending on `voice`'s ever-changing identity. */
  const voiceRef = useRef<ReturnType<typeof useVoiceCommand> | null>(null);

  const persistFallback = useCallback((requiresTextFallback: boolean) => {
    setSyncError(false);
    void persistPreference(requiresTextFallback).then((success) => {
      if (!success) setSyncError(true);
    });
  }, []);

  const resolveAsVoiceMode = useCallback(() => {
    if (probeResolvedRef.current) return;
    probeResolvedRef.current = true;
    setIsVoiceMode(true);
    setIsPreferenceLoading(false);
    persistFallback(false);
  }, [persistFallback]);

  const resolveAsTextMode = useCallback(() => {
    if (probeResolvedRef.current) return;
    probeResolvedRef.current = true;
    setIsVoiceMode(false);
    setIsPreferenceLoading(false);
    persistFallback(true);
  }, [persistFallback]);

  const { voiceLanguage, setVoiceLanguage } = useApp();

  const voice = useVoiceCommand({
    // Stay enabled through the probe itself, and afterward for as long as
    // we're in voice mode. Once resolved to text mode, disable — the mic
    // should not keep running in the background.
    enabled: isPreferenceLoading || isVoiceMode,
    lang: voiceLanguage || "en-US",
    onSpeechDetected: resolveAsVoiceMode,
    onFallbackTriggered: resolveAsTextMode,
    onResult: (spokenText) => {
      const detected = detectTextLanguage(spokenText);
      if (detected && detected !== voiceLanguage) {
        setVoiceLanguage(detected);
        setGlobalVoiceLanguage(detected);
      }
    },
  });

  useEffect(() => {
    voiceRef.current = voice;
  });

  /**
   * Runs the full activation decision: DB short-circuit, then (if needed)
   * the 3-attempt mic probe. `isPreferenceLoading` stays true for the
   * entire duration.
   */
  const runActivationFlow = useCallback(async (options?: { skipStoredPreference?: boolean }) => {
    probeResolvedRef.current = false;
    setIsPreferenceLoading(true);
    setIsVoiceMode(false);

    if (!options?.skipStoredPreference) {
      const stored = await fetchStoredPreference();
      if (stored === true) {
        probeResolvedRef.current = true;
        setIsVoiceMode(false);
        setIsPreferenceLoading(false);
        return;
      }
    }

    // No usable stored preference (or explicitly bypassed) — probe live.
    // No gesture, no button: start listening the instant we decide to probe.
    voiceRef.current?.resetStrikes();
    setHasRequestedPermission(true);
    voiceRef.current?.start();
  }, []);

  // Kick off the activation flow once, on mount (home page entry).
  useEffect(() => {
    void runActivationFlow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-run on auth changes: a different user signing in must get *their*
  // preference and their own fresh probe, not the previous session's.
  useEffect(() => {
    const supabase = supabaseRef.current;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        voiceRef.current?.stop();
        setHasRequestedPermission(false);
        void runActivationFlow();
      } else if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        void runActivationFlow();
      }
    });

    return () => subscription.unsubscribe();
  }, [runActivationFlow]);

  const requestVoiceStart = useCallback(() => {
    setHasRequestedPermission(true);
    voiceRef.current?.start();
  }, []);

  const retryVoiceMode = useCallback(() => {
    void runActivationFlow({ skipStoredPreference: true });
  }, [runActivationFlow]);

  const switchToTextMode = useCallback(() => {
    voiceRef.current?.stop();
    probeResolvedRef.current = true;
    setIsVoiceMode(false);
    setIsPreferenceLoading(false);
    persistFallback(true);
  }, [persistFallback]);

  const value = useMemo<GlobalVoiceContextValue>(
    () => ({
      isSupported: voice.isSupported,
      isListening: voice.isListening,
      isRequestingPermission: voice.isRequestingPermission,
      hasRequestedPermission,
      isPreferenceLoading,
      transcript: voice.transcript,
      interimTranscript: voice.interimTranscript,
      attemptsFailed: voice.strikes,
      maxAttempts: MAX_ACTIVATION_ATTEMPTS,
      isVoiceMode,
      isTextFallbackMode: !isVoiceMode,
      permissionDenied: voice.permissionDenied,
      syncError,
      requestVoiceStart,
      retryVoiceMode,
      switchToTextMode,
    }),
    [
      voice.isSupported,
      voice.isListening,
      voice.isRequestingPermission,
      voice.transcript,
      voice.interimTranscript,
      voice.strikes,
      voice.permissionDenied,
      hasRequestedPermission,
      isPreferenceLoading,
      isVoiceMode,
      syncError,
      requestVoiceStart,
      retryVoiceMode,
      switchToTextMode,
    ]
  );

  return (
    <GlobalVoiceContext.Provider value={value}>
      {children}
    </GlobalVoiceContext.Provider>
  );
}
