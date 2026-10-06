"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { RoleId, User } from "./types";
import { upsertUser, updateUserRole } from "./db";
import { SpeechProviderType, ConversationLanguageState } from "./speech/types";

const STORAGE_KEY = "careerforge_user";
const VOICE_MODE_KEY = "careerforge_voice_mode";
const VOICE_LANG_KEY = "careerforge_voice_lang";
const SPEECH_PROVIDER_KEY = "careerforge_speech_provider";
const VOICE_CHECKED_KEY = "careerforge_voice_checked";
const ACCESS_PREFS_KEY = "careerforge_access_prefs";
const USER_SKILLS_KEY = "careerforge_user_skills";
const LOCATION_KEY = "careerforge_location";
export const ACCESSIBILITY_PROFILE_KEY = "careerforge_accessibility_profile";
export const VOICE_CONSENT_KEY = "careerforge_voice_consent_status";

export type AccessibilityProfile = "blind_low_vision" | "deaf_hard_of_hearing" | "standard";
export type VoiceConsentStatus = "granted" | "denied" | "not_requested";

export interface AccessibilityPreferences {
  interactionMode: "voice" | "text" | "hybrid";
  speechOutput: boolean;
  voiceNavigation: boolean;
  visualResponses: boolean;
  simplifiedLanguage: boolean;
  captions: boolean;
  screenReaderMode: boolean;
  highContrast: boolean;
  largeText: boolean;
  reducedMotion: boolean;
}

export const defaultAccessibilityPreferences: AccessibilityPreferences = {
  interactionMode: "text",
  speechOutput: true,
  voiceNavigation: false,
  visualResponses: true,
  simplifiedLanguage: false,
  captions: true,
  screenReaderMode: false,
  highContrast: false,
  largeText: false,
  reducedMotion: false,
};

interface AppState {
  user: User | null;
  ready: boolean;
  signIn: (email: string, name?: string) => Promise<void>;
  signInAsGuest: () => Promise<void>;
  setAuthenticatedUser: (user: User) => void;
  signInWithGoogle: (
    name: string,
    email: string,
    picture?: string,
    accessToken?: string,
  ) => Promise<void>;
  signInWithGithub: (
    name: string,
    email: string,
    picture?: string,
  ) => Promise<void>;
  signInWithPhone: (phone: string, name?: string) => Promise<void>;
  signOut: () => void;
  setTargetRole: (role: RoleId) => void;
  // ─── Voice & Accessibility Mode State ──────────────────────────────────────
  accessibilityProfile: AccessibilityProfile;
  setAccessibilityProfile: (profile: AccessibilityProfile) => void;
  voiceConsentStatus: VoiceConsentStatus;
  setVoiceConsentStatus: (status: VoiceConsentStatus) => void;
  voiceMode: boolean;
  voiceLanguage: string;
  speechProvider: SpeechProviderType;
  voiceChecked: boolean;
  accessibilityPrefs: AccessibilityPreferences;
  conversationLanguageState: ConversationLanguageState;
  setVoiceMode: (active: boolean) => void;
  setVoiceLanguage: (lang: string) => void;
  setSpeechProvider: (provider: SpeechProviderType) => void;
  setVoiceChecked: (checked: boolean) => void;
  setAccessibilityPrefs: (prefs: Partial<AccessibilityPreferences>) => void;
  setConversationLanguageState: (
    state: Partial<ConversationLanguageState>,
  ) => void;
  // ─── Session State for Agent Intelligence ──────────────────────────────────
  currentLocation: string | null;
  setCurrentLocation: (loc: string | null) => void;
  userSkills: string[];
  setUserSkills: (skills: string[]) => void;
  missingSkills: string[];
  setMissingSkills: (skills: string[]) => void;
  activeResumeText: string | null;
  setActiveResumeText: (text: string | null) => void;
}

/** The slice of AppProvider state persisted server-side via /api/user. */
export interface PersistedUserState {
  voiceMode: boolean;
  voiceLanguage: string;
  speechProvider: SpeechProviderType;
  voiceChecked: boolean;
  accessibilityPrefs: AccessibilityPreferences;
  userSkills: string[];
  currentLocation: string | null;
}

const AppContext = createContext<AppState | null>(null);

function extractDisplayName(email: string, name?: string): string {
  if (name && name.trim()) return name.trim();
  const username = email.split("@")[0] || "User";
  return username
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [voiceMode, setVoiceModeState] = useState(true);
  const [voiceLanguage, setVoiceLanguageState] = useState("auto");
  const [speechProvider, setSpeechProviderState] =
    useState<SpeechProviderType>("auto");
  const [voiceChecked, setVoiceCheckedState] = useState(false);
  const [accessibilityPrefs, setAccessibilityPrefsState] =
    useState<AccessibilityPreferences>(defaultAccessibilityPreferences);
  const [conversationLanguageState, setConversationLanguageStateState] =
    useState<ConversationLanguageState>({
      detectedLanguage: "en",
      preferredLanguage: "auto",
    });
  const [currentLocation, setCurrentLocationState] = useState<string | null>(
    null,
  );
  const [userSkills, setUserSkillsState] = useState<string[]>([]);
  const [missingSkills, setMissingSkillsState] = useState<string[]>([]);
  const [activeResumeText, setActiveResumeTextState] = useState<string | null>(
    null,
  );
  const [accessibilityProfile, setAccessibilityProfileState] =
    useState<AccessibilityProfile>("standard");
  const [voiceConsentStatus, setVoiceConsentStatusState] =
    useState<VoiceConsentStatus>("not_requested");

  const setAccessibilityProfile = (profile: AccessibilityProfile) => {
    setAccessibilityProfileState(profile);
    try {
      window.localStorage.setItem(ACCESSIBILITY_PROFILE_KEY, profile);
    } catch {}
  };

  const setVoiceConsentStatus = (status: VoiceConsentStatus) => {
    setVoiceConsentStatusState(status);
    try {
      window.localStorage.setItem(VOICE_CONSENT_KEY, status);
    } catch {}
  };

  // Hydrate instantly from localStorage, then sync with server in background
  useEffect(() => {
    let cancelled = false;

    // Step 1: Immediately restore from localStorage synchronously so UI renders with zero delay
    try {
      const prof = window.localStorage.getItem(ACCESSIBILITY_PROFILE_KEY);
      if (prof) setAccessibilityProfileState(prof as AccessibilityProfile);

      const vcs = window.localStorage.getItem(VOICE_CONSENT_KEY);
      if (vcs) setVoiceConsentStatusState(vcs as VoiceConsentStatus);
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.email) setUser(parsed);
      }

      const vm = window.localStorage.getItem(VOICE_MODE_KEY);
      if (vm !== null) setVoiceModeState(vm === "true");

      const vl = window.localStorage.getItem(VOICE_LANG_KEY);
      if (vl) setVoiceLanguageState(vl);

      const sp = window.localStorage.getItem(SPEECH_PROVIDER_KEY);
      if (sp) setSpeechProviderState(sp as SpeechProviderType);

      const vc = window.localStorage.getItem(VOICE_CHECKED_KEY);
      if (vc !== null) setVoiceCheckedState(vc === "true");

      const ap = window.localStorage.getItem(ACCESS_PREFS_KEY);
      if (ap) setAccessibilityPrefsState(JSON.parse(ap));

      const sk = window.localStorage.getItem(USER_SKILLS_KEY);
      if (sk) setUserSkillsState(JSON.parse(sk));

      const loc = window.localStorage.getItem(LOCATION_KEY);
      if (loc) setCurrentLocationState(loc);
    } catch {
      // localStorage unavailable or restricted
    }

    // Set ready immediately on mount so the user never encounters a blank screen!
    setReady(true);

    // Step 2: Server-authoritative session sync with /api/auth/session & /api/user
    (async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2500);

        // 1. Authoritative Session Check
        const sessRes = await fetch("/api/auth/session", {
          credentials: "include",
          signal: controller.signal,
        });

        if (!sessRes.ok) {
          // If server rejects session (401 / expired), strictly invalidate client state!
          if (!cancelled) {
            setUser(null);
            try {
              window.localStorage.removeItem(STORAGE_KEY);
            } catch {}
          }
          clearTimeout(timeout);
          return;
        }

        const sessionData = await sessRes.json();
        if (sessionData.authenticated && sessionData.user) {
          const authUser: User = {
            id: sessionData.user.id,
            name: sessionData.user.name || extractDisplayName(sessionData.user.email),
            email: sessionData.user.email,
            authProvider: sessionData.user.isGuest ? "guest" : "email",
            targetRole: null,
            dbId: sessionData.user.id,
          };
          if (!cancelled) {
            setUser(authUser);
            try {
              window.localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
            } catch {}
          }
        }

        // 2. Sync profile preferences
        const res = await fetch("/api/user", {
          credentials: "include",
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          const { user: u, state } = (await res.json()) as {
            user: User | null;
            state: PersistedUserState | null;
          };

          if (!cancelled && u) {
            setUser((prev) => ({ ...(prev || u), ...u }));
            try {
              window.localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
            } catch {}
          }
          if (!cancelled && state) {
            setVoiceModeState(state.voiceMode);
            setVoiceLanguageState(state.voiceLanguage);
            setSpeechProviderState(state.speechProvider);
            setVoiceCheckedState(state.voiceChecked);
            setAccessibilityPrefsState(state.accessibilityPrefs);
            setUserSkillsState(state.userSkills);
            setCurrentLocationState(state.currentLocation);
          }
        }
      } catch {
        // Server fetch timed out or offline — safely using local state
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced write-back of the persisted slice (replaces the old
  // per-setter localStorage.setItem calls).
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      const state: PersistedUserState = {
        voiceMode,
        voiceLanguage,
        speechProvider,
        voiceChecked,
        accessibilityPrefs,
        userSkills,
        currentLocation,
      };
      fetch("/api/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ user, state }),
      }).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [
    ready,
    user,
    voiceMode,
    voiceLanguage,
    speechProvider,
    voiceChecked,
    accessibilityPrefs,
    userSkills,
    currentLocation,
  ]);

  // Apply visual accessibility preferences to document root
  useEffect(() => {
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      if (accessibilityPrefs.highContrast) root.classList.add("high-contrast");
      else root.classList.remove("high-contrast");

      if (accessibilityPrefs.largeText) root.classList.add("large-text");
      else root.classList.remove("large-text");

      if (accessibilityPrefs.reducedMotion)
        root.classList.add("reduced-motion");
      else root.classList.remove("reduced-motion");
    }
  }, [accessibilityPrefs]);

  // Setters just update state; the debounced effect above syncs to /api/user.
  const persist = (next: User | null) => {
    setUser(next);
    try {
      if (next) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {}
  };

  const setVoiceMode = (active: boolean) => {
    setVoiceModeState(active);
    setAccessibilityPrefsState((prev) => ({
      ...prev,
      interactionMode: active ? "voice" : "text",
      speechOutput: active,
    }));
  };

  const setVoiceLanguage = (lang: string) => setVoiceLanguageState(lang);

  const setVoiceChecked = (checked: boolean) => setVoiceCheckedState(checked);

  const setAccessibilityPrefs = (prefs: Partial<AccessibilityPreferences>) => {
    setAccessibilityPrefsState((prev) => ({ ...prev, ...prefs }));
  };

  const setCurrentLocation = (loc: string | null) =>
    setCurrentLocationState(loc);

  const setUserSkills = (skills: string[]) => setUserSkillsState(skills);

  const setMissingSkills = (skills: string[]) => {
    setMissingSkillsState(skills);
  };

  const setActiveResumeText = (text: string | null) => {
    setActiveResumeTextState(text);
  };

  /** Authoritative Session Hydration helper: sets user in state & local storage */
  const setAuthenticatedUser = (authUser: User) => {
    persist(authUser);
  };

  /** Canonical Server-Authoritative Guest sign-in */
  const signInAsGuest = async () => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mode: "guest" }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.user) {
        const guestUser: User = {
          id: data.user.id,
          name: data.user.name || "Guest Explorer",
          email: data.user.email,
          authProvider: "guest",
          targetRole: user?.targetRole ?? null,
          dbId: data.user.id,
        };
        persist(guestUser);
        return;
      }
      throw new Error(data.message || data.error || "Authentication service is temporarily unavailable. Please try again.");
    } catch (e) {
      console.warn("[auth] Guest login failed:", e);
      throw e instanceof Error ? e : new Error("Authentication service is temporarily unavailable. Please try again.");
    }
  };

  /** Server-Authoritative Email Sign-in / Sign-up */
  const signIn = async (email: string, name?: string) => {
    const cleanEmail = email.trim().toLowerCase();
    const displayName = extractDisplayName(cleanEmail, name);

    // Guest Mode check: delegate to canonical guest login
    if (cleanEmail.startsWith("guest_") || cleanEmail.includes("@guest.")) {
      await signInAsGuest();
      return;
    }

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mode: "oauth",
          email: cleanEmail,
          name: displayName,
          authProvider: "email",
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.user) {
        const authUser: User = {
          id: data.user.id,
          name: data.user.name || displayName,
          email: data.user.email,
          authProvider: "email",
          targetRole: user?.targetRole ?? null,
          dbId: data.user.id,
        };
        persist(authUser);
        return;
      }
      throw new Error(data.message || data.error || "Authentication service is temporarily unavailable. Please try again.");
    } catch (e) {
      console.warn("[auth] Server signin sync failed:", e);
      throw e instanceof Error ? e : new Error("Authentication service is temporarily unavailable. Please try again.");
    }
  };

  /** Server-Authoritative Google sign-in */
  const signInWithGoogle = async (
    name: string,
    email: string,
    picture?: string,
    accessToken?: string,
  ) => {
    const cleanEmail = email.trim().toLowerCase();
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mode: "oauth",
          email: cleanEmail,
          name,
          authProvider: "google",
          picture,
          accessToken,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.user) {
        const authUser: User = {
          id: data.user.id,
          name: data.user.name || name,
          email: data.user.email,
          picture: data.user.picture || picture,
          authProvider: "google",
          targetRole: user?.targetRole ?? null,
          dbId: data.user.id,
        };
        persist(authUser);
        return;
      }
      throw new Error(data.message || data.error || "Google authentication failed on server.");
    } catch (e) {
      console.error("[auth] Google server signin error:", e);
      throw e;
    }
  };

  /** Server-Authoritative GitHub sign-in */
  const signInWithGithub = async (
    name: string,
    email: string,
    picture?: string,
  ) => {
    const cleanEmail = email.trim().toLowerCase();
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mode: "oauth",
          email: cleanEmail,
          name: name || cleanEmail.split("@")[0],
          authProvider: "github",
          picture,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.user) {
        const authUser: User = {
          id: data.user.id,
          name: data.user.name || name,
          email: data.user.email,
          picture: data.user.picture || picture,
          authProvider: "github",
          targetRole: user?.targetRole ?? null,
          dbId: data.user.id,
        };
        persist(authUser);
        return;
      }
      throw new Error(data.message || data.error || "GitHub authentication failed on server.");
    } catch (e) {
      console.warn("[auth] GitHub server signin failed:", e);
      throw e instanceof Error ? e : new Error("GitHub authentication failed on server.");
    }
  };

  /** Server-Authoritative Phone sign-in */
  const signInWithPhone = async (phone: string, name?: string) => {
    const cleanPhone = phone.trim();
    const formattedEmail = `${cleanPhone.replace(/[^0-9]/g, "")}@phone.careerforge.io`;
    const displayName = name || `User (${cleanPhone})`;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mode: "phone",
          email: formattedEmail,
          name: displayName,
          authProvider: "phone",
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.user) {
        const authUser: User = {
          id: data.user.id,
          name: data.user.name || displayName,
          email: data.user.email,
          phone: cleanPhone,
          authProvider: "phone",
          targetRole: user?.targetRole ?? null,
          dbId: data.user.id,
        };
        persist(authUser);
        return;
      }
      throw new Error(data.message || data.error || "Phone authentication failed on server.");
    } catch (e) {
      console.warn("[auth] Phone server signin failed:", e);
      throw e instanceof Error ? e : new Error("Phone authentication failed on server.");
    }
  };

  const signOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      await fetch("/api/user", { method: "DELETE", credentials: "include" });
    } catch {}
    persist(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
  };

  const setTargetRole = (role: RoleId) => {
    if (!user) return;
    if ((role as any) === "__SKIPPED__" || (role as any) === "__DONT_KNOW__") return;
    const updated = { ...user, targetRole: role };
    persist(updated);
    // Sync role to DB
    if (user.dbId) {
      updateUserRole(user.dbId, role).catch((e) =>
        console.warn("[auth] updateUserRole failed:", e),
      );
    }
  };

  const setSpeechProvider = (provider: SpeechProviderType) =>
    setSpeechProviderState(provider);

  const setConversationLanguageState = (
    state: Partial<ConversationLanguageState>,
  ) => {
    setConversationLanguageStateState((prev) => ({ ...prev, ...state }));
  };

  return (
    <AppContext.Provider
      value={{
        user,
        ready,
        signIn,
        signInAsGuest,
        setAuthenticatedUser,
        signInWithGoogle,
        signInWithGithub,
        signInWithPhone,
        signOut,
        setTargetRole,
        accessibilityProfile,
        setAccessibilityProfile,
        voiceConsentStatus,
        setVoiceConsentStatus,
        voiceMode,
        voiceLanguage,
        speechProvider,
        voiceChecked,
        accessibilityPrefs,
        conversationLanguageState,
        setVoiceMode,
        setVoiceLanguage,
        setSpeechProvider,
        setVoiceChecked,
        setAccessibilityPrefs,
        setConversationLanguageState,
        currentLocation,
        setCurrentLocation,
        userSkills,
        setUserSkills,
        missingSkills,
        setMissingSkills,
        activeResumeText,
        setActiveResumeText,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
