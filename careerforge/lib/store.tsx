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
  voiceMode: boolean;
  voiceLanguage: string;
  voiceChecked: boolean;
  signIn: (email: string, name?: string) => Promise<void>;
  signInWithGoogle: (name: string, email: string, picture?: string) => Promise<void>;
  signInWithGithub: (name: string, email: string, picture?: string) => Promise<void>;
  signInWithPhone: (phone: string, name?: string) => Promise<void>;
  signOut: () => void;
  setTargetRole: (role: RoleId) => void;
  setVoiceMode: (mode: boolean) => void;
  setVoiceLanguage: (lang: string) => void;
  setVoiceChecked: (checked: boolean) => void;
}

const AppContext = createContext<AppState | null>(null);
const STORAGE_KEY = "careerforge.user";
const VOICE_MODE_KEY = "careerforge.voiceMode";
const VOICE_LANG_KEY = "careerforge.voiceLang";

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
  const [voiceLanguage, setVoiceLanguageState] = useState("en-IN");
  const [voiceChecked, setVoiceChecked] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw));

      const rawVoiceMode = window.localStorage.getItem(VOICE_MODE_KEY);
      if (rawVoiceMode !== null) setVoiceModeState(rawVoiceMode === "true");

      const rawVoiceLang = window.localStorage.getItem(VOICE_LANG_KEY);
      if (rawVoiceLang) setVoiceLanguageState(rawVoiceLang);
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

  const setVoiceMode = (mode: boolean) => {
    setVoiceModeState(mode);
    try {
      window.localStorage.setItem(VOICE_MODE_KEY, String(mode));
    } catch {}
  };

  const setVoiceLanguage = (lang: string) => {
    setVoiceLanguageState(lang);
    try {
      window.localStorage.setItem(VOICE_LANG_KEY, lang);
    } catch {}
  };

  /** Email sign-in / sign-up — upserts user to DB then persists locally. */
  const signIn = async (email: string, name?: string) => {
    const displayName = extractDisplayName(email, name);
    const localUser: User = {
      name: displayName,
      email,
      targetRole: user?.targetRole ?? null,
      dbId: null,
    };
    persist(localUser);

    try {
      const dbRow = await upsertUser({
        email,
        name: localUser.name,
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

  /** Google sign-in — upserts user to DB then persists locally. */
  const signInWithGoogle = async (name: string, email: string, picture?: string) => {
    const localUser: User = {
      name: name || extractDisplayName(email),
      email,
      avatarUrl: picture,
      authProvider: "google",
      targetRole: user?.targetRole ?? null,
      dbId: null,
    };
    persist(localUser);

    try {
      const dbRow = await upsertUser({
        email,
        name: localUser.name,
        avatarUrl: picture,
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

  /** GitHub sign-in — upserts user to DB then persists locally. */
  const signInWithGithub = async (name: string, email: string, picture?: string) => {
    const localUser: User = {
      name: name || extractDisplayName(email),
      email,
      avatarUrl: picture,
      authProvider: "github",
      targetRole: user?.targetRole ?? null,
      dbId: null,
    };
    persist(localUser);

    try {
      const dbRow = await upsertUser({
        email,
        name: localUser.name,
        avatarUrl: picture,
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
    const cleanPhone = phone.replace(/[^0-9+]/g, "");
    const formattedEmail = `phone_${cleanPhone.replace("+", "")}@careerforge.local`;
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
        voiceMode,
        voiceLanguage,
        voiceChecked,
        signIn,
        signInWithGoogle,
        signInWithGithub,
        signInWithPhone,
        signOut,
        setTargetRole,
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
