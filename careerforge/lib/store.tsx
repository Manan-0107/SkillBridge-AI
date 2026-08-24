"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { RoleId, User } from "./types";

interface AppState {
  user: User | null;
  ready: boolean;
  signIn: (email: string, name?: string) => void;
  signInWithGoogle: (name: string, email: string) => void;
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

  // Email/password stand-in. Replace with a real API call (e.g. POST /api/auth)
  // and store a session token instead of the raw profile.
  const signIn = (email: string, name?: string) => {
    persist({
      name: name || email.split("@")[0],
      email,
      authProvider: "email",
      targetRole: user?.targetRole ?? null,
    });
  };

  // Stub for Google OAuth. Wire to @react-oauth/google or NextAuth's Google
  // provider using NEXT_PUBLIC_GOOGLE_CLIENT_ID, then call this with the
  // decoded profile.
  const signInWithGoogle = (name: string, email: string) => {
    persist({ name, email, authProvider: "google", targetRole: user?.targetRole ?? null });
  };

  const signOut = () => persist(null);

  const setTargetRole = (role: RoleId) => {
    if (!user) return;
    persist({ ...user, targetRole: role });
  };

  return (
    <AppContext.Provider
      value={{ user, ready, signIn, signInWithGoogle, signOut, setTargetRole }}
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
