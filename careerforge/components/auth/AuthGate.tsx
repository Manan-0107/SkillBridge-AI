"use client";

import { FormEvent, useState } from "react";
import { useApp } from "@/lib/store";
import {
  FieldLabel,
  GhostButton,
  PrimaryButton,
  inputClasses,
} from "@/components/ui/Primitives";

export function AuthGate() {
  const { signIn, signInWithGoogle } = useApp();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) return setError("Enter a valid email address.");
    if (password.length < 6)
      return setError("Password needs at least 6 characters.");
    setError("");
    signIn(email, mode === "signup" ? name : undefined);
  };

  // Stub — replace with @react-oauth/google's useGoogleLogin, or route through
  // NextAuth's Google provider, then call signInWithGoogle(profile.name, profile.email).
  const handleGoogleAuth = () => {
    signInWithGoogle("Alex Rivera", "alex.rivera@gmail.com");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-display text-2xl italic text-ink">CareerForge</p>
          <p className="mt-2 text-sm text-graphite">
            One quiet workspace to plan the next role.
          </p>
        </div>

        <div className="mb-6 flex rounded-md border border-line p-1">
          <button
            onClick={() => setMode("signup")}
            className={`flex-1 rounded py-2 text-sm font-medium transition-colors ${
              mode === "signup" ? "bg-ink text-paper" : "text-graphite"
            }`}
          >
            Create account
          </button>
          <button
            onClick={() => setMode("signin")}
            className={`flex-1 rounded py-2 text-sm font-medium transition-colors ${
              mode === "signin" ? "bg-ink text-paper" : "text-graphite"
            }`}
          >
            Sign in
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <FieldLabel>Name</FieldLabel>
              <input
                className={inputClasses}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Rivera"
                required
              />
            </div>
          )}
          <div>
            <FieldLabel>Email</FieldLabel>
            <input
              type="email"
              className={inputClasses}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              required
            />
          </div>
          <div>
            <FieldLabel>Password</FieldLabel>
            <input
              type="password"
              className={inputClasses}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p className="text-sm text-red-700">{error}</p>}

          <PrimaryButton type="submit" className="w-full">
            {mode === "signup" ? "Create account" : "Sign in"}
          </PrimaryButton>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-line" />
          <span className="text-xs text-graphite">or</span>
          <div className="h-px flex-1 bg-line" />
        </div>

        <GhostButton onClick={handleGoogleAuth} className="w-full gap-2">
          <GoogleMark />
          Continue with Google
        </GhostButton>

        <p className="mt-6 text-center text-xs text-graphite">
          By continuing you agree this is a demo — email/password is stored
          locally, not on a server.
        </p>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.6H24v9h11.8c-.5 2.7-2 5-4.3 6.6v5.5h7C42.3 37 45.1 31.3 45.1 24.5z"/>
      <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-7-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.6-3.9-12.4-9.1h-7.2v5.7C7.9 40.9 15.3 46 24 46z"/>
      <path fill="#FBBC05" d="M11.6 28.2c-.5-1.3-.7-2.7-.7-4.2s.3-2.9.7-4.2v-5.7H4.3C2.8 17.1 2 20.4 2 24s.8 6.9 2.3 9.9l7.3-5.7z"/>
      <path fill="#EA4335" d="M24 10.7c3.2 0 6.1 1.1 8.4 3.3l6.2-6.2C34.9 4.2 29.9 2 24 2 15.3 2 7.9 7.1 4.3 14.1l7.2 5.7c1.9-5.2 6.7-9.1 12.5-9.1z"/>
    </svg>
  );
}
