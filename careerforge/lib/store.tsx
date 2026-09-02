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
  signInWithGoogle: (
    name: string,
    email: string,
    picture?: string,
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

  // Hydrate from the server (replaces the old localStorage bootstrap).
  useEffect(() => {
    let cancelled = false;

    (async () => {
      let serverSuccess = false;

      try {
        const res = await fetch("/api/user", { credentials: "include" });
        if (res.ok) {
          const { user: u, state } = (await res.json()) as {
            user: User | null;
            state: PersistedUserState | null;
          };

          if (!cancelled && u) setUser(u);
          if (!cancelled && state) {
            setVoiceModeState(state.voiceMode);
            setVoiceLanguageState(state.voiceLanguage);
            setSpeechProviderState(state.speechProvider);
            setVoiceCheckedState(state.voiceChecked);
            setAccessibilityPrefsState(state.accessibilityPrefs);
            setUserSkillsState(state.userSkills);
            setCurrentLocationState(state.currentLocation);
            serverSuccess = true;
          }
        }
      } catch {
        // Server/DB unavailable — proceed to fallback
      }

      // Fallback to localStorage if server fetch failed or returned no state
      if (!cancelled && !serverSuccess) {
        try {
          const raw = window.localStorage.getItem(STORAGE_KEY);
          if (raw) {
            setUser(JSON.parse(raw));
          } else {
            const defaultCandidate: User = {
              email: "alex.rivera@example.com",
              name: "Alex Rivera",
              targetRole: "frontend",
            };
            setUser(defaultCandidate);
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
          // localStorage unavailable — proceed unauthenticated
        }
      }

      if (!cancelled) setReady(true);
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
  const persist = (next: User | null) => setUser(next);

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

  /** Email sign-in / sign-up — upserts user to DB then persists locally. */
  const signIn = async (email: string, name?: string) => {
    const displayName = extractDisplayName(email, name);
    // Immediately sign in locally so the UI responds instantly
    const localUser: User = {
      name: displayName,
      email,
      authProvider: "email",
      targetRole: user?.targetRole ?? null,
      dbId: null,
    };
    persist(localUser);

    // Persist to DB in the background (doesn't block the UI)
    try {
      const dbRow = await upsertUser({
        email,
        name: localUser.name,
        authProvider: "email",
        targetRole: localUser.targetRole ?? undefined,
      });
      if (dbRow?.id) {
        const updated = { ...localUser, dbId: dbRow.id };
        persist(updated);
      }
    } catch (e) {
      console.warn("[auth] DB upsert failed:", e);
    }
  };

  /** Google sign-in — upserts Google profile to DB then persists locally. */
  const signInWithGoogle = async (
    name: string,
    email: string,
    picture?: string,
  ) => {
    const localUser: User = {
      name,
      email,
      picture,
      authProvider: "google",
      targetRole: user?.targetRole ?? null,
      dbId: null,
    };
    persist(localUser);

    try {
      const dbRow = await upsertUser({
        email,
        name,
        picture,
        authProvider: "google",
        targetRole: localUser.targetRole ?? undefined,
      });
      if (dbRow?.id) {
        const updated = { ...localUser, dbId: dbRow.id };
        persist(updated);
      }
    } catch (e) {
      console.warn("[auth] DB upsert failed:", e);
    }
  };

  /** GitHub sign-in — upserts GitHub profile to DB then persists locally. */
  const signInWithGithub = async (
    name: string,
    email: string,
    picture?: string,
  ) => {
    const localUser: User = {
      name: name || email.split("@")[0],
      email,
      picture,
      authProvider: "github",
      targetRole: user?.targetRole ?? null,
      dbId: null,
    };
    persist(localUser);

    try {
      const dbRow = await upsertUser({
        email,
        name: localUser.name,
        picture,
        authProvider: "github",
        targetRole: localUser.targetRole ?? undefined,
      });
      if (dbRow?.id) {
        const updated = { ...localUser, dbId: dbRow.id };
        persist(updated);
      }
    } catch (e) {
      console.warn("[auth] DB upsert failed:", e);
    }
  };

  /** Phone sign-in — upserts phone user to DB then persists locally. */
  const signInWithPhone = async (phone: string, name?: string) => {
    const cleanPhone = phone.trim();
    const formattedEmail = `${cleanPhone.replace(/[^0-9]/g, "")}@phone.careerforge.io`;
    const localUser: User = {
      name: name || `User (${cleanPhone})`,
      email: formattedEmail,
      phone: cleanPhone,
      authProvider: "phone",
      targetRole: user?.targetRole ?? null,
      dbId: null,
    };
    persist(localUser);

    try {
      const dbRow = await upsertUser({
        email: formattedEmail,
        name: localUser.name,
        phone: cleanPhone,
        authProvider: "phone",
        targetRole: localUser.targetRole ?? undefined,
      });
      if (dbRow?.id) {
        const updated = { ...localUser, dbId: dbRow.id };
        persist(updated);
      }
    } catch (e) {
      console.warn("[auth] DB upsert failed:", e);
    }
  };

  const signOut = () => {
    persist(null);
    fetch("/api/user", { method: "DELETE", credentials: "include" }).catch(
      () => {},
    );
  };

  const setTargetRole = (role: RoleId) => {
    if (!user) return;
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
        signInWithGoogle,
        signInWithGithub,
        signInWithPhone,
        signOut,
        setTargetRole,
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
