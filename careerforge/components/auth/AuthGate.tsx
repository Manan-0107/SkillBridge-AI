"use client";

import { FormEvent, useState } from "react";
import { useApp } from "@/lib/store";
import { hasGoogleClientId, requestGoogleProfile } from "@/lib/googleAuth";
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
  const [googleBusy, setGoogleBusy] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentName, setConsentName] = useState("");
  const [consentEmail, setConsentEmail] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) return setError("Enter a valid email address.");
    if (password.length < 6)
      return setError("Password needs at least 6 characters.");
    setError("");
    signIn(email, mode === "signup" ? name : undefined);
  };

  const handleGoogleAuth = async () => {
    setError("");
    setGoogleBusy(true);
    try {
      const profile = await requestGoogleProfile();
      signInWithGoogle(profile.name, profile.email, profile.picture);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "MISSING_CLIENT_ID" || (err instanceof Error && err.name === "MISSING_CLIENT_ID")) {
        setConsentOpen(true);
      } else {
        setError(message || "Google sign-in was cancelled.");
      }
    } finally {
      setGoogleBusy(false);
    }
  };

  const allowDemoGoogle = (e: FormEvent) => {
    e.preventDefault();
    if (!consentEmail.includes("@")) {
      setError("Enter the Google email you want to share.");
      return;
    }
    setError("");
    signInWithGoogle(consentName || consentEmail.split("@")[0], consentEmail);
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

          {error && !consentOpen && <p className="text-sm text-red-700">{error}</p>}

          <PrimaryButton type="submit" className="w-full">
            {mode === "signup" ? "Create account" : "Sign in"}
          </PrimaryButton>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-line" />
          <span className="text-xs text-graphite">or</span>
          <div className="h-px flex-1 bg-line" />
        </div>

        <GhostButton
          type="button"
          onClick={handleGoogleAuth}
          disabled={googleBusy}
          className="w-full gap-2"
        >
          <GoogleMark />
          {googleBusy ? "Waiting for Google…" : "Continue with Google"}
        </GhostButton>

        <p className="mt-6 text-center text-xs text-graphite">
          Google will ask to share your name, email address, and profile photo
          with CareerForge.
          {!hasGoogleClientId() && (
            <>
              {" "}
              Add NEXT_PUBLIC_GOOGLE_CLIENT_ID in .env.local for the real Google
              account picker.
            </>
          )}
        </p>
      </div>

      {consentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4">
          <div className="w-full max-w-md rounded-xl border border-line bg-paper p-6 shadow-lg">
            <div className="mb-4 flex items-center gap-2">
              <GoogleMark />
              <p className="text-sm font-medium text-ink">Sign in with Google</p>
            </div>
            <h2 className="font-display text-2xl italic text-ink">
              CareerForge wants to access your Google Account
            </h2>
            <p className="mt-2 text-sm text-graphite">
              This lets CareerForge receive the following info:
            </p>
            <ul className="mt-4 space-y-2 text-sm text-ink">
              <li className="rounded-md border border-line bg-white/70 px-3 py-2">
                View your email address
              </li>
              <li className="rounded-md border border-line bg-white/70 px-3 py-2">
                View your personal info, including name and profile photo
              </li>
            </ul>

            <form onSubmit={allowDemoGoogle} className="mt-5 space-y-3">
              <p className="text-xs text-graphite">
                Google Cloud client ID is not set, so choose the account details
                you want to share. With a client ID, this step is Google’s own
                permission screen.
              </p>
              <div>
                <FieldLabel>Name</FieldLabel>
                <input
                  className={inputClasses}
                  value={consentName}
                  onChange={(e) => setConsentName(e.target.value)}
                  placeholder="Name on your Google account"
                  required
                />
              </div>
              <div>
                <FieldLabel>Email</FieldLabel>
                <input
                  type="email"
                  className={inputClasses}
                  value={consentEmail}
                  onChange={(e) => setConsentEmail(e.target.value)}
                  placeholder="you@gmail.com"
                  required
                />
              </div>
              {error && <p className="text-sm text-red-700">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <GhostButton type="button" onClick={() => setConsentOpen(false)}>
                  Deny
                </GhostButton>
                <PrimaryButton type="submit">Allow</PrimaryButton>
              </div>
            </form>
          </div>
        </div>
      )}
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
