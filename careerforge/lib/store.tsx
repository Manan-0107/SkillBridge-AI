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
  voiceChecked: boolean;
  setVoiceMode: (active: boolean) => void;
  setVoiceLanguage: (lang: string) => void;
  setVoiceChecked: (checked: boolean) => void;
}

const AppContext = createContext<AppState | null>(null);
const STORAGE_KEY = "careerforge.user";
const VOICE_MODE_KEY = "careerforge.voiceMode";
const VOICE_LANG_KEY = "careerforge.voiceLang";
const VOICE_CHECKED_KEY = "careerforge.voiceChecked";

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
  const [voiceMode, setVoiceModeState] = useState(false);
  const [voiceLanguage, setVoiceLanguageState] = useState("auto");
  const [voiceChecked, setVoiceCheckedState] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw));

      const vm = window.localStorage.getItem(VOICE_MODE_KEY);
      if (vm !== null) setVoiceModeState(vm === "true");

      const vl = window.localStorage.getItem(VOICE_LANG_KEY);
      if (vl) setVoiceLanguageState(vl);

      const vc = window.localStorage.getItem(VOICE_CHECKED_KEY);
      if (vc !== null) setVoiceCheckedState(vc === "true");
    } catch {
      // localStorage unavailable — proceed unauthenticated
    }
    setReady(true);
  }, []);

  const persist = (next: User | null) => {
    setUser(next);
    if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else window.localStorage.removeItem(STORAGE_KEY);
  };

  const setVoiceMode = (active: boolean) => {
    setVoiceModeState(active);
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
        voiceChecked,
        setVoiceMode,
        setVoiceLanguage,
        setVoiceChecked,
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
