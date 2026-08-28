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
}

const AppContext = createContext<AppState | null>(null);
const STORAGE_KEY = "careerforge.user";

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw));
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

  /** Email sign-in / sign-up — upserts user to DB then persists locally. */
  const signIn = async (email: string, name?: string) => {
    // Immediately sign in locally so the UI responds instantly
    const localUser: User = {
      name: name || email.split("@")[0],
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
      // DB is optional — continue without it
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
