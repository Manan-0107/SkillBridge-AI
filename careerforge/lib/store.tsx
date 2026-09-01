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
  signInWithGoogle: (name: string, email: string, picture?: string) => Promise<void>;
  signInWithGithub: (name: string, email: string, picture?: string) => Promise<void>;
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
  setConversationLanguageState: (state: Partial<ConversationLanguageState>) => void;
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

const AppContext = createContext<AppState | null>(null);
const STORAGE_KEY = "careerforge.user";
const VOICE_MODE_KEY = "careerforge.voiceMode";
const VOICE_LANG_KEY = "careerforge.voiceLang";
const VOICE_CHECKED_KEY = "careerforge.voiceChecked";
const ACCESS_PREFS_KEY = "careerforge.accessPrefs";
const USER_SKILLS_KEY = "careerforge.userSkills";
const LOCATION_KEY = "careerforge.userLocation";

function extractDisplayName(email: string, name?: string): string {
  if (name && name.trim()) return name.trim();
  const username = email.split("@")[0] || "User";
  return username
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const SPEECH_PROVIDER_KEY = "careerforge.speechProvider";

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [voiceMode, setVoiceModeState] = useState(true);
  const [voiceLanguage, setVoiceLanguageState] = useState("auto");
  const [speechProvider, setSpeechProviderState] = useState<SpeechProviderType>("auto");
  const [voiceChecked, setVoiceCheckedState] = useState(false);
  const [accessibilityPrefs, setAccessibilityPrefsState] = useState<AccessibilityPreferences>(
    defaultAccessibilityPreferences
  );
  const [conversationLanguageState, setConversationLanguageStateState] = useState<ConversationLanguageState>({
    detectedLanguage: "en",
    preferredLanguage: "auto",
  });
  const [currentLocation, setCurrentLocationState] = useState<string | null>(null);
  const [userSkills, setUserSkillsState] = useState<string[]>([]);
  const [missingSkills, setMissingSkillsState] = useState<string[]>([]);
  const [activeResumeText, setActiveResumeTextState] = useState<string | null>(null);

  useEffect(() => {
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
    setReady(true);
  }, []);

  // Apply visual accessibility preferences to document root
  useEffect(() => {
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      if (accessibilityPrefs.highContrast) root.classList.add("high-contrast");
      else root.classList.remove("high-contrast");

      if (accessibilityPrefs.largeText) root.classList.add("large-text");
      else root.classList.remove("large-text");

      if (accessibilityPrefs.reducedMotion) root.classList.add("reduced-motion");
      else root.classList.remove("reduced-motion");
    }
  }, [accessibilityPrefs]);

  const persist = (next: User | null) => {
    setUser(next);
    if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else window.localStorage.removeItem(STORAGE_KEY);
  };

  const setVoiceMode = (active: boolean) => {
    setVoiceModeState(active);
    setAccessibilityPrefsState((prev) => ({
      ...prev,
      interactionMode: active ? "voice" : "text",
      speechOutput: active,
    }));
    try {
      window.localStorage.setItem(VOICE_MODE_KEY, String(active));
    } catch {}
  };

  const setVoiceLanguage = (lang: string) => {
    setVoiceLanguageState(lang);
    try {
      window.localStorage.setItem(VOICE_LANG_KEY, lang);
    } catch {}
  };

  const setVoiceChecked = (checked: boolean) => {
    setVoiceCheckedState(checked);
    try {
      window.localStorage.setItem(VOICE_CHECKED_KEY, String(checked));
    } catch {}
  };

  const setAccessibilityPrefs = (prefs: Partial<AccessibilityPreferences>) => {
    setAccessibilityPrefsState((prev) => {
      const next = { ...prev, ...prefs };
      try {
        window.localStorage.setItem(ACCESS_PREFS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const setCurrentLocation = (loc: string | null) => {
    setCurrentLocationState(loc);
    try {
      if (loc) window.localStorage.setItem(LOCATION_KEY, loc);
      else window.localStorage.removeItem(LOCATION_KEY);
    } catch {}
  };

  const setUserSkills = (skills: string[]) => {
    setUserSkillsState(skills);
    try {
      window.localStorage.setItem(USER_SKILLS_KEY, JSON.stringify(skills));
    } catch {}
  };

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
  const signInWithGoogle = async (name: string, email: string, picture?: string) => {
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
  const signInWithGithub = async (name: string, email: string, picture?: string) => {
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

  const signOut = () => persist(null);

  const setTargetRole = (role: RoleId) => {
    if (!user) return;
    const updated = { ...user, targetRole: role };
    persist(updated);
    // Sync role to DB
    if (user.dbId) {
      updateUserRole(user.dbId, role).catch((e) =>
        console.warn("[auth] updateUserRole failed:", e)
      );
    }
  };

  const setSpeechProvider = (provider: SpeechProviderType) => {
    setSpeechProviderState(provider);
    try {
      window.localStorage.setItem(SPEECH_PROVIDER_KEY, provider);
    } catch {}
  };

  const setConversationLanguageState = (state: Partial<ConversationLanguageState>) => {
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
