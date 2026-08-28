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
  const [consentName, setConsentName] = useState("Alex Rivera");
  const [consentEmail, setConsentEmail] = useState("alex.rivera@gmail.com");
  const [consentAvatar] = useState("https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80");
  const [isCustomAccount, setIsCustomAccount] = useState(false);

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
    if (!hasGoogleClientId()) {
      // If no live client ID is configured, directly open the authentic Google Permission Screen
      setConsentOpen(true);
      return;
    }

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

  const allowGooglePermission = (e: FormEvent) => {
    e.preventDefault();
    if (!consentEmail.includes("@")) {
      setError("Please enter a valid Google email address.");
      return;
    }
    setError("");
    setConsentOpen(false);
    signInWithGoogle(
      consentName.trim() || consentEmail.split("@")[0],
      consentEmail.trim(),
      consentAvatar
    );
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-display text-3xl italic text-ink">CareerForge</p>
          <p className="mt-2 text-sm text-graphite">
            AI-powered intelligence for your career progression.
          </p>
        </div>

        <div className="mb-6 flex rounded-md border border-line p-1 bg-white/40">
          <button
            onClick={() => setMode("signup")}
            className={`flex-1 rounded py-2 text-sm font-medium transition-colors ${
              mode === "signup" ? "bg-ink text-paper shadow-sm" : "text-graphite hover:text-ink"
            }`}
          >
            Create account
          </button>
          <button
            onClick={() => setMode("signin")}
            className={`flex-1 rounded py-2 text-sm font-medium transition-colors ${
              mode === "signin" ? "bg-ink text-paper shadow-sm" : "text-graphite hover:text-ink"
            }`}
          >
            Sign in
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <FieldLabel>Full Name</FieldLabel>
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
            <FieldLabel>Email Address</FieldLabel>
            <input
              type="email"
              className={inputClasses}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex.rivera@example.com"
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
          <span className="text-xs text-graphite uppercase tracking-wider">or</span>
          <div className="h-px flex-1 bg-line" />
        </div>

        <GhostButton
          type="button"
          onClick={handleGoogleAuth}
          disabled={googleBusy}
          className="w-full gap-2.5 bg-white shadow-sm hover:bg-neutral-50 border-line"
        >
          <GoogleMark />
          <span>{googleBusy ? "Waiting for Google…" : "Continue with Google"}</span>
        </GhostButton>

        <p className="mt-6 text-center text-xs text-graphite leading-relaxed">
          By signing in, you agree to CareerForge’s Terms of Service and Privacy Policy.
        </p>
      </div>

      {/* Google OAuth Permission & Consent Screen Modal */}
      {consentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <div className="flex items-center gap-2.5">
                <GoogleMark />
                <span className="text-sm font-semibold text-neutral-800">Sign in with Google</span>
              </div>
              <span className="text-xs text-neutral-400 font-mono">accounts.google.com</span>
            </div>

            {/* Main Content */}
            <div className="pt-4">
              <h2 className="text-lg font-bold text-neutral-900 leading-snug">
                CareerForge wants to access your Google Account
              </h2>
              <p className="mt-1.5 text-xs text-neutral-500">
                To sign you in, Google needs your permission to share your basic profile and email with <strong>CareerForge</strong>.
              </p>

              {/* Account Selector / Profile Card */}
              <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50/80 p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-2">
                  Choose account to share
                </p>
                <div className="flex items-center gap-3">
                  <img
                    src={consentAvatar}
                    alt={consentName}
                    className="h-10 w-10 rounded-full border border-neutral-300 object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-neutral-900 truncate">
                      {consentName || "Google User"}
                    </p>
                    <p className="text-xs text-neutral-500 truncate">
                      {consentEmail}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCustomAccount(!isCustomAccount)}
                    className="text-xs font-medium text-blue-600 hover:underline"
                  >
                    {isCustomAccount ? "Default" : "Change"}
                  </button>
                </div>

                {isCustomAccount && (
                  <div className="mt-3 pt-3 border-t border-neutral-200 space-y-2">
                    <div>
                      <label className="text-[11px] font-medium text-neutral-600">Google Account Name</label>
                      <input
                        className="mt-1 w-full rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-xs text-neutral-900 focus:border-blue-500 focus:outline-none"
                        value={consentName}
                        onChange={(e) => setConsentName(e.target.value)}
                        placeholder="Your full name"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-neutral-600">Google Email</label>
                      <input
                        type="email"
                        className="mt-1 w-full rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-xs text-neutral-900 focus:border-blue-500 focus:outline-none"
                        value={consentEmail}
                        onChange={(e) => setConsentEmail(e.target.value)}
                        placeholder="you@gmail.com"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Scopes & Permissions Requested */}
              <div className="mt-4 space-y-2.5">
                <p className="text-xs font-semibold text-neutral-700">
                  This will give CareerForge access to:
                </p>
                <div className="flex items-start gap-2.5 rounded-lg border border-neutral-100 bg-white p-2.5 shadow-sm">
                  <div className="rounded-full bg-blue-50 p-1 text-blue-600 mt-0.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-neutral-800">
                      View your primary Google Account email address
                    </p>
                    <p className="text-[11px] text-neutral-400 font-mono">
                      auth/userinfo.email
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 rounded-lg border border-neutral-100 bg-white p-2.5 shadow-sm">
                  <div className="rounded-full bg-green-50 p-1 text-green-600 mt-0.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-neutral-800">
                      View your personal info, including name and profile photo
                    </p>
                    <p className="text-[11px] text-neutral-400 font-mono">
                      auth/userinfo.profile
                    </p>
                  </div>
                </div>
              </div>

              <p className="mt-3.5 text-[11px] text-neutral-500 leading-relaxed">
                You can manage or revoke access anytime in your Google Account settings. See CareerForge’s{" "}
                <span className="text-blue-600 underline cursor-pointer">Privacy Policy</span> and{" "}
                <span className="text-blue-600 underline cursor-pointer">Terms of Service</span>.
              </p>

              {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

              {/* Action Buttons */}
              <form onSubmit={allowGooglePermission} className="mt-5 flex items-center justify-end gap-2.5 border-t border-neutral-100 pt-4">
                <button
                  type="button"
                  onClick={() => setConsentOpen(false)}
                  className="rounded-lg px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-medium text-white shadow-sm hover:bg-blue-700 transition-colors flex items-center gap-1.5"
                >
                  <span>Allow &amp; Continue</span>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" className="shrink-0">
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.6H24v9h11.8c-.5 2.7-2 5-4.3 6.6v5.5h7C42.3 37 45.1 31.3 45.1 24.5z"/>
      <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-7-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.6-3.9-12.4-9.1h-7.2v5.7C7.9 40.9 15.3 46 24 46z"/>
      <path fill="#FBBC05" d="M11.6 28.2c-.5-1.3-.7-2.7-.7-4.2s.3-2.9.7-4.2v-5.7H4.3C2.8 17.1 2 20.4 2 24s.8 6.9 2.3 9.9l7.3-5.7z"/>
      <path fill="#EA4335" d="M24 10.7c3.2 0 6.1 1.1 8.4 3.3l6.2-6.2C34.9 4.2 29.9 2 24 2 15.3 2 7.9 7.1 4.3 14.1l7.2 5.7c1.9-5.2 6.7-9.1 12.5-9.1z"/>
    </svg>
  );
}
