"use client";

import { FormEvent, useState, useRef, useEffect } from "react";
import { useApp } from "@/lib/store";
import { hasGoogleClientId, requestGoogleProfile } from "@/lib/googleAuth";
import {
  FieldLabel,
  GhostButton,
  PrimaryButton,
} from "@/components/ui/Primitives";
import {
  startSpeechRecognition,
  SpeechRecognitionController,
  normalizeSpokenEmail,
  normalizeSpokenName,
  normalizeSpokenPassword,
  playAccessibleChime,
  isSpeechRecognitionSupported,
} from "@/lib/voice";

const COUNTRY_CODES = [
  { code: "+1", country: "United States / Canada", flag: "🇺🇸" },
  { code: "+91", country: "India", flag: "🇮🇳" },
  { code: "+44", country: "United Kingdom", flag: "🇬🇧" },
  { code: "+61", country: "Australia", flag: "🇦🇺" },
  { code: "+49", country: "Germany", flag: "🇩🇪" },
  { code: "+33", country: "France", flag: "🇫🇷" },
  { code: "+81", country: "Japan", flag: "🇯🇵" },
  { code: "+971", country: "UAE", flag: "🇦🇪" },
  { code: "+65", country: "Singapore", flag: "🇸🇬" },
  { code: "+86", country: "China", flag: "🇨🇳" },
  { code: "+55", country: "Brazil", flag: "🇧🇷" },
  { code: "+27", country: "South Africa", flag: "🇿🇦" },
  { code: "+234", country: "Nigeria", flag: "🇳🇬" },
  { code: "+92", country: "Pakistan", flag: "🇵🇰" },
  { code: "+880", country: "Bangladesh", flag: "🇧🇩" },
  { code: "+31", country: "Netherlands", flag: "🇳🇱" },
  { code: "+966", country: "Saudi Arabia", flag: "🇸🇦" },
  { code: "+39", country: "Italy", flag: "🇮🇹" },
  { code: "+34", country: "Spain", flag: "🇪🇸" },
  { code: "+52", country: "Mexico", flag: "🇲🇽" },
  { code: "+64", country: "New Zealand", flag: "🇳🇿" },
  { code: "+82", country: "South Korea", flag: "🇰🇷" },
];

export function AuthGate() {
  const { signIn, signInWithGoogle, signInWithGithub, signInWithPhone, voiceLanguage } = useApp();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Active section tracking
  const [activeSection, setActiveSection] = useState<"name" | "email" | "password">(
    mode === "signup" ? "name" : "email"
  );

  // Dedicated per-field voice dictation state
  const [dictatingField, setDictatingField] = useState<"name" | "email" | "password" | null>(null);
  const fieldControllerRef = useRef<SpeechRecognitionController | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Google Modal State
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleModalOpen, setGoogleModalOpen] = useState(false);
  const [googleName, setGoogleName] = useState("");
  const [googleEmail, setGoogleEmail] = useState("");

  // GitHub Modal State
  const [githubModalOpen, setGithubModalOpen] = useState(false);
  const [githubUsername, setGithubUsername] = useState("");
  const [githubEmail, setGithubEmail] = useState("");

  // Phone Modal State
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [countryCode, setCountryCode] = useState("+1");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneName, setPhoneName] = useState("");
  const [phoneStep, setPhoneStep] = useState<"input" | "otp">("input");
  const [phoneOtp, setPhoneOtp] = useState("");

  useEffect(() => {
    const open = googleModalOpen || githubModalOpen || phoneModalOpen;
    if (!open) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => {
      const selector = googleModalOpen
        ? "input"
        : githubModalOpen
        ? "input"
        : phoneStep === "otp"
        ? "input"
        : "select, input";
      const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
      dialog?.querySelector<HTMLElement>(selector)?.focus();
    }, 0);

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (googleModalOpen) setGoogleModalOpen(false);
      if (githubModalOpen) setGithubModalOpen(false);
      if (phoneModalOpen) setPhoneModalOpen(false);
    };
    document.addEventListener("keydown", handleEscape);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleEscape);
      previousFocus?.focus();
    };
  }, [googleModalOpen, githubModalOpen, phoneModalOpen, phoneStep]);

  useEffect(() => {
    // When switching mode, reset active section
    setActiveSection(mode === "signup" ? "name" : "email");
    setError("");
  }, [mode]);

  // Listen for voice-guided section transitions and real-time voice typing sync
  useEffect(() => {
    const handleAuthSection = (e: Event) => {
      const custom = e as CustomEvent<{ section: "name" | "email" | "password" }>;
      if (custom.detail?.section) {
        const sec = custom.detail.section;
        setActiveSection(sec);
        if (sec === "name") nameInputRef.current?.focus();
        if (sec === "email") emailInputRef.current?.focus();
        if (sec === "password") passwordInputRef.current?.focus();
      }
    };

    const handleAuthValue = (e: Event) => {
      const custom = e as CustomEvent<{ field: "name" | "email" | "password"; value: string }>;
      if (custom.detail?.field && typeof custom.detail?.value === "string") {
        if (custom.detail.field === "name") setName(custom.detail.value);
        if (custom.detail.field === "email") setEmail(custom.detail.value);
        if (custom.detail.field === "password") setPassword(custom.detail.value);
      }
    };

    window.addEventListener("careerforge:auth-section", handleAuthSection);
    window.addEventListener("careerforge:auth-value", handleAuthValue);

    // Hydrate existing verified profile from anonymous storage if available
    try {
      const raw = localStorage.getItem("careerforge_interview_state");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.name) setName(parsed.name);
        if (parsed.email) setEmail(parsed.email);
      }
    } catch {}

    fetch("/api/profile/anonymous")
      .then((res) => res.json())
      .then((data) => {
        if (data?.ok && data.profile) {
          if (data.profile.name) setName(data.profile.name);
          if (data.profile.email) setEmail(data.profile.email);
        }
      })
      .catch(() => {});

    return () => {
      window.removeEventListener("careerforge:auth-section", handleAuthSection);
      window.removeEventListener("careerforge:auth-value", handleAuthValue);
    };
  }, []);

  // Clean up any active field speech recognition when unmounting
  useEffect(() => {
    return () => {
      if (fieldControllerRef.current) {
        fieldControllerRef.current.stop();
      }
    };
  }, []);

  // ─── Per-Field Voice Dictation Handler ──────────────────────────────────────
  const toggleFieldDictation = (field: "name" | "email" | "password") => {
    if (dictatingField === field) {
      // Stop dictation
      fieldControllerRef.current?.stop();
      fieldControllerRef.current = null;
      setDictatingField(null);
      return;
    }

    if (!isSpeechRecognitionSupported()) {
      setError("Speech recognition is not supported in this browser. Please type directly.");
      return;
    }

    // Stop previous controller if running
    fieldControllerRef.current?.stop();
    setActiveSection(field);
    setDictatingField(field);
    playAccessibleChime("start");

    // Focus target input
    if (field === "name") nameInputRef.current?.focus();
    if (field === "email") emailInputRef.current?.focus();
    if (field === "password") passwordInputRef.current?.focus();

    const controller = startSpeechRecognition({
      lang: voiceLanguage !== "auto" ? voiceLanguage : "en-US",
      onListeningChange: (isListening) => {
        if (!isListening && dictatingField === field) {
          setDictatingField(null);
        }
      },
      onTranscript: (transcript: string, isFinal?: boolean) => {
        const clean = transcript.trim();
        if (!clean) return;

        if (field === "name") {
          const val = normalizeSpokenName(clean);
          setName(val);
          if (isFinal) {
            playAccessibleChime("success");
            setDictatingField(null);
            // Auto advance to email
            setTimeout(() => {
              setActiveSection("email");
              emailInputRef.current?.focus();
            }, 300);
          }
        } else if (field === "email") {
          const val = normalizeSpokenEmail(clean);
          setEmail(val);
          if (isFinal) {
            playAccessibleChime("success");
            setDictatingField(null);
            // Auto advance to password
            setTimeout(() => {
              setActiveSection("password");
              passwordInputRef.current?.focus();
            }, 300);
          }
        } else if (field === "password") {
          const cleanPass = normalizeSpokenPassword(clean);
          setPassword(cleanPass);
          if (isFinal) {
            playAccessibleChime("success");
            setDictatingField(null);
            if (cleanPass.length < 6) {
              setError("Password needs at least 6 characters (e.g. 123456).");
            } else {
              setError("");
            }
          }
        }
      },
      onError: () => {
        setDictatingField(null);
      },
    });

    fieldControllerRef.current = controller;
  };

  // ─── Direct Form Submit with /api/auth/login API Integration ───────────────
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (mode === "signup" && name.trim().length < 2) {
      setActiveSection("name");
      nameInputRef.current?.focus();
      return setError("Please enter your full name (at least 2 characters).");
    }

    if (!email.includes("@")) {
      setActiveSection("email");
      emailInputRef.current?.focus();
      return setError("Enter a valid email address.");
    }

    if (password.length < 6) {
      setActiveSection("password");
      passwordInputRef.current?.focus();
      return setError("Password needs at least 6 characters.");
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          name: mode === "signup" ? name.trim() : undefined,
          mode,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Authentication failed. Please check your details.");
      }

      playAccessibleChime("success");
      // Persist authenticated user to App Store
      await signIn(data.user.email, data.user.name);
    } catch (err: any) {
      setError(err.message || "An error occurred during authentication.");
    } finally {
      setLoading(false);
    }
  };

  // ─── Guest Demo Login Flow ──────────────────────────────────────────────────
  const handleGuestLogin = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "guest" }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        playAccessibleChime("success");
        await signIn(data.user.email, data.user.name);
      }
    } catch {
      await signIn("alex.rivera@example.com", "Alex Rivera");
    } finally {
      setLoading(false);
    }
  };

  // ─── Google Auth Flow ───────────────────────────────────────────────────────
  const handleGoogleAuth = async () => {
    setError("");
    if (!hasGoogleClientId()) {
      setGoogleModalOpen(true);
      return;
    }

    setGoogleBusy(true);
    try {
      const profile = await requestGoogleProfile();
      signInWithGoogle(profile.name, profile.email, profile.picture);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "MISSING_CLIENT_ID" || (err instanceof Error && err.name === "MISSING_CLIENT_ID")) {
        setGoogleModalOpen(true);
      } else {
        setError(message || "Google sign-in was cancelled.");
      }
    } finally {
      setGoogleBusy(false);
    }
  };

  const allowGooglePermission = (e: FormEvent) => {
    e.preventDefault();
    if (!googleEmail.includes("@")) {
      setError("Please enter a valid Google email address.");
      return;
    }
    setError("");
    setGoogleModalOpen(false);
    signInWithGoogle(
      googleName.trim() || googleEmail.split("@")[0],
      googleEmail.trim(),
      `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(googleName || googleEmail)}`
    );
  };

  // ─── GitHub Auth Flow ──────────────────────────────────────────────────────
  const handleGithubSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!githubUsername.trim()) {
      setError("Please enter your GitHub username.");
      return;
    }
    const resolvedEmail = githubEmail.trim() || `${githubUsername.trim().toLowerCase()}@users.noreply.github.com`;
    setError("");
    setGithubModalOpen(false);
    signInWithGithub(
      githubUsername.trim(),
      resolvedEmail,
      `https://github.com/${encodeURIComponent(githubUsername.trim())}.png`
    );
  };

  // ─── Phone Auth Flow ────────────────────────────────────────────────────────
  const handleSendOtp = (e: FormEvent) => {
    e.preventDefault();
    if (phoneNumber.replace(/\D/g, "").length < 6) {
      setError("Please enter a valid phone number.");
      return;
    }
    setError("");
    setPhoneStep("otp");
  };

  const handleVerifyOtp = (e: FormEvent) => {
    e.preventDefault();
    if (phoneOtp.length < 4) {
      setError("Please enter the verification code (e.g. 123456).");
      return;
    }
    setError("");
    setPhoneModalOpen(false);
    const fullPhone = `${countryCode} ${phoneNumber.trim()}`;
    signInWithPhone(fullPhone, phoneName.trim() || undefined);
  };

  // Validation flags for visual step progression
  const isNameDone = name.trim().length >= 2;
  const isEmailDone = email.includes("@") && email.length >= 5;
  const isPasswordDone = password.length >= 6;

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4 py-8 sm:px-6 sm:py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Top Header */}
        <div className="text-center">
          <p className="font-display text-4xl italic text-ink">CareerForge</p>
          <p className="mt-2 text-sm text-graphite">
            AI-powered career intelligence, skill gap discovery, and roadmap engineering.
          </p>
        </div>

        {/* ─── Main Auth Card ──────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-line bg-white p-6 sm:p-8 shadow-sm">
          {/* Mode Switcher: Create Account vs Sign In */}
          <div className="mb-6 flex rounded-md border border-line p-1 bg-neutral-50">
            <button
              type="button"
              onClick={() => setMode("signup")}
              className={`flex-1 rounded py-2 text-sm font-medium transition-colors ${
                mode === "signup" ? "bg-ink text-paper shadow-sm" : "text-graphite hover:text-ink"
              }`}
            >
              Create account
            </button>
            <button
              type="button"
              onClick={() => setMode("signin")}
              className={`flex-1 rounded py-2 text-sm font-medium transition-colors ${
                mode === "signin" ? "bg-ink text-paper shadow-sm" : "text-graphite hover:text-ink"
              }`}
            >
              Sign in
            </button>
          </div>

          {/* ─── Multi-Section Step Indicator ─────────────────────────────────── */}
          <div className="mb-6 rounded-xl border border-neutral-200 bg-neutral-50/70 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 mb-2">
              Step-by-Step Entry:
            </p>
            <div className="flex items-center gap-1.5 text-xs">
              {mode === "signup" && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSection("name");
                      nameInputRef.current?.focus();
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                      activeSection === "name"
                        ? "bg-neutral-900 text-white shadow-xs"
                        : isNameDone
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-neutral-200 text-neutral-600 hover:bg-neutral-300"
                    }`}
                  >
                    <span>{isNameDone ? "✓" : "1"}</span>
                    <span>Name</span>
                  </button>
                  <span className="text-neutral-400">→</span>
                </>
              )}

              <button
                type="button"
                onClick={() => {
                  setActiveSection("email");
                  emailInputRef.current?.focus();
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                  activeSection === "email"
                    ? "bg-neutral-900 text-white shadow-xs"
                    : isEmailDone
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-neutral-200 text-neutral-600 hover:bg-neutral-300"
                }`}
              >
                <span>{isEmailDone ? "✓" : mode === "signup" ? "2" : "1"}</span>
                <span>Email</span>
              </button>

              <span className="text-neutral-400">→</span>

              <button
                type="button"
                onClick={() => {
                  setActiveSection("password");
                  passwordInputRef.current?.focus();
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                  activeSection === "password"
                    ? "bg-neutral-900 text-white shadow-xs"
                    : isPasswordDone
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-neutral-200 text-neutral-600 hover:bg-neutral-300"
                }`}
              >
                <span>{isPasswordDone ? "✓" : mode === "signup" ? "3" : "2"}</span>
                <span>Password</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* ── SECTION 1: Full Name (Signup only) ────────────────────────── */}
            {mode === "signup" && (
              <div
                className={`rounded-xl border p-3 transition-all ${
                  activeSection === "name"
                    ? "border-neutral-900 bg-neutral-50/50 shadow-xs ring-1 ring-neutral-900/10"
                    : "border-neutral-200 hover:border-neutral-300"
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <FieldLabel>
                    Full Name {isNameDone && <span className="text-emerald-600 font-bold ml-1">✓</span>}
                  </FieldLabel>
                  <button
                    type="button"
                    onClick={() => toggleFieldDictation("name")}
                    title="Dictate Full Name with Voice"
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all ${
                      dictatingField === "name"
                        ? "bg-red-500 text-white animate-pulse"
                        : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                    }`}
                  >
                    <span>🎙️</span>
                    <span>{dictatingField === "name" ? "Listening..." : "Speak Name"}</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    ref={nameInputRef}
                    id="auth-name-input"
                    name="name"
                    type="text"
                    aria-label="Full Name"
                    className="w-full rounded-md border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-graphite/60 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                    value={name}
                    onFocus={() => setActiveSection("name")}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Rivera"
                    required
                  />
                </div>
                <p className="mt-1 text-[11px] text-neutral-500">
                  {activeSection === "name"
                    ? "👉 Active Section: Type your name or click 'Speak Name'."
                    : "Your display name across CareerForge."}
                </p>
              </div>
            )}

            {/* ── SECTION 2: Email Address ──────────────────────────────────── */}
            <div
              className={`rounded-xl border p-3 transition-all ${
                activeSection === "email"
                  ? "border-neutral-900 bg-neutral-50/50 shadow-xs ring-1 ring-neutral-900/10"
                  : "border-neutral-200 hover:border-neutral-300"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <FieldLabel>
                  Email Address {isEmailDone && <span className="text-emerald-600 font-bold ml-1">✓</span>}
                </FieldLabel>
                <button
                  type="button"
                  onClick={() => toggleFieldDictation("email")}
                  title="Dictate Email Address with Voice"
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all ${
                    dictatingField === "email"
                      ? "bg-red-500 text-white animate-pulse"
                      : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                  }`}
                >
                  <span>🎙️</span>
                  <span>{dictatingField === "email" ? "Listening..." : "Speak Email"}</span>
                </button>
              </div>
              <div className="relative">
                <input
                  ref={emailInputRef}
                  id="auth-email-input"
                  name="email"
                  type="email"
                  aria-label="Email Address"
                  className="w-full rounded-md border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-graphite/60 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  value={email}
                  onFocus={() => setActiveSection("email")}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex.rivera@example.com"
                  required
                />
              </div>
              <p className="mt-1 text-[11px] text-neutral-500">
                {activeSection === "email"
                  ? "👉 Active Section: Type your email or click 'Speak Email'."
                  : "We use this for your roadmap alerts and account sign-in."}
              </p>
            </div>

            {/* ── SECTION 3: Password ───────────────────────────────────────── */}
            <div
              className={`rounded-xl border p-3 transition-all ${
                activeSection === "password"
                  ? "border-neutral-900 bg-neutral-50/50 shadow-xs ring-1 ring-neutral-900/10"
                  : "border-neutral-200 hover:border-neutral-300"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <FieldLabel>
                  Password {isPasswordDone && <span className="text-emerald-600 font-bold ml-1">✓</span>}
                </FieldLabel>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] font-semibold text-neutral-600 hover:text-neutral-900 underline"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleFieldDictation("password")}
                    title="Dictate Password with Voice"
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all ${
                      dictatingField === "password"
                        ? "bg-red-500 text-white animate-pulse"
                        : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                    }`}
                  >
                    <span>🎙️</span>
                    <span>{dictatingField === "password" ? "Listening..." : "Speak Password"}</span>
                  </button>
                </div>
              </div>
              <div className="relative">
                <input
                  ref={passwordInputRef}
                  id="auth-password-input"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  aria-label="Password"
                  className="w-full rounded-md border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-graphite/60 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                  value={password}
                  onFocus={() => setActiveSection("password")}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                />
              </div>
              <p className="mt-1 text-[11px] text-neutral-500">
                {activeSection === "password"
                  ? "👉 Active Section: Type or speak your password (must be at least 6 characters, e.g. 123456)."
                  : "Needs at least 6 characters (e.g. 123456)."}
              </p>
            </div>

            {error && !googleModalOpen && !githubModalOpen && !phoneModalOpen && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs font-medium text-red-700">
                ⚠️ {error}
              </div>
            )}

            <PrimaryButton
              type="submit"
              id="submit-btn"
              disabled={loading}
              className="w-full py-3 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Processing...</span>
                </>
              ) : (
                <span>{mode === "signup" ? "Create account" : "Sign in"}</span>
              )}
            </PrimaryButton>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-line" />
            <span className="text-xs text-graphite uppercase tracking-wider">or continue with</span>
            <div className="h-px flex-1 bg-line" />
          </div>

          {/* Multi-Provider Auth Buttons */}
          <div className="grid gap-2.5 sm:grid-cols-3">
            {/* Google Button */}
            <GhostButton
              type="button"
              onClick={handleGoogleAuth}
              disabled={googleBusy}
              className="w-full justify-center gap-2 bg-white shadow-sm hover:bg-neutral-50 border-line py-2.5"
            >
              <GoogleMark />
              <span className="text-xs font-semibold">Google</span>
            </GhostButton>

            {/* GitHub Button */}
            <GhostButton
              type="button"
              onClick={() => {
                setError("");
                setGithubModalOpen(true);
              }}
              className="w-full justify-center gap-2 bg-white shadow-sm hover:bg-neutral-50 border-line py-2.5"
            >
              <GithubMark />
              <span className="text-xs font-semibold">GitHub</span>
            </GhostButton>

            {/* Phone Button */}
            <GhostButton
              type="button"
              onClick={() => {
                setError("");
                setPhoneStep("input");
                setPhoneModalOpen(true);
              }}
              className="w-full justify-center gap-2 bg-white shadow-sm hover:bg-neutral-50 border-line py-2.5"
            >
              <PhoneMark />
              <span className="text-xs font-semibold">Phone</span>
            </GhostButton>
          </div>

          {/* Guest / Demo Access Button for Instant Evaluation */}
          <div className="mt-4 pt-4 border-t border-line/60">
            <button
              type="button"
              onClick={handleGuestLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/80 py-2.5 px-3 text-xs font-semibold text-neutral-700 hover:bg-white hover:border-neutral-900 hover:text-neutral-900 transition-all shadow-2xs cursor-pointer"
            >
              <span>🚀 Explore Platform as Guest (Candidate Demo)</span>
            </button>
          </div>

          <p className="mt-6 text-center text-xs text-graphite leading-relaxed">
            By continuing, you agree to CareerForge’s Terms of Service and Accessibility Standards.
          </p>
        </div>
      </div>

      {/* ─── Google OAuth Permission Screen Modal ─────────────────────────────── */}
      {googleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div role="dialog" aria-modal="true" aria-label="Sign in with Google" className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <div className="flex items-center gap-2.5">
                <GoogleMark />
                <span className="text-sm font-semibold text-neutral-800">Sign in with Google</span>
              </div>
              <span className="text-xs text-neutral-400 font-mono">accounts.google.com</span>
            </div>

            <div className="pt-4">
              <h2 className="text-base font-bold text-neutral-900 leading-snug">
                CareerForge wants to access your Google Account
              </h2>
              <p className="mt-1 text-xs text-neutral-500">
                Grant permission to share your basic profile and email address with <strong>CareerForge</strong>.
              </p>

              <form onSubmit={allowGooglePermission} className="mt-4 space-y-3 rounded-xl border border-neutral-200 bg-neutral-50/80 p-4">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
                    Your Google Account Name
                  </label>
                  <input
                    className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 focus:border-blue-500 focus:outline-none"
                    value={googleName}
                    onChange={(e) => setGoogleName(e.target.value)}
                    placeholder="e.g. Alex Rivera"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
                    Your Google Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 focus:border-blue-500 focus:outline-none"
                    value={googleEmail}
                    onChange={(e) => setGoogleEmail(e.target.value)}
                    placeholder="you@gmail.com"
                  />
                </div>

                {error && <p className="text-xs text-red-600">{error}</p>}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setGoogleModalOpen(false)}
                    className="rounded-lg border border-neutral-200 px-4 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-blue-700"
                  >
                    Allow &amp; Continue
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ─── GitHub OAuth Modal ──────────────────────────────────────────────── */}
      {githubModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div role="dialog" aria-modal="true" aria-label="Sign in with GitHub" className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <div className="flex items-center gap-2.5">
                <GithubMark />
                <span className="text-sm font-semibold text-neutral-800">Sign in with GitHub</span>
              </div>
              <span className="text-xs text-neutral-400 font-mono">github.com/login/oauth</span>
            </div>

            <div className="pt-4">
              <h2 className="text-base font-bold text-neutral-900 leading-snug">
                Authorize CareerForge on GitHub
              </h2>
              <p className="mt-1 text-xs text-neutral-500">
                Connect your GitHub profile to showcase code repositories and import verified skills.
              </p>

              <form onSubmit={handleGithubSubmit} className="mt-4 space-y-3 rounded-xl border border-neutral-200 bg-neutral-50/80 p-4">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
                    GitHub Username <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 focus:border-neutral-900 focus:outline-none"
                    value={githubUsername}
                    onChange={(e) => setGithubUsername(e.target.value)}
                    placeholder="e.g. torvalds"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
                    Email Address (Optional)
                  </label>
                  <input
                    type="email"
                    className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 focus:border-neutral-900 focus:outline-none"
                    value={githubEmail}
                    onChange={(e) => setGithubEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>

                {error && <p className="text-xs text-red-600">{error}</p>}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setGithubModalOpen(false)}
                    className="rounded-lg border border-neutral-200 px-4 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-neutral-900 px-4 py-2 text-xs font-medium text-white shadow-sm hover:bg-neutral-800"
                  >
                    Authorize CareerForge
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ─── Phone OTP Verification Modal ────────────────────────────────────── */}
      {phoneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div role="dialog" aria-modal="true" aria-label="Phone authentication" className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <div className="flex items-center gap-2.5">
                <PhoneMark />
                <span className="text-sm font-semibold text-neutral-800">Phone Authentication</span>
              </div>
              <span className="text-xs text-neutral-400 font-mono">SMS OTP</span>
            </div>

            <div className="pt-4">
              {phoneStep === "input" ? (
                <>
                  <h2 className="text-base font-bold text-neutral-900 leading-snug">
                    Sign in with your mobile number
                  </h2>
                  <p className="mt-1 text-xs text-neutral-500">
                    We will send an accessible 6-digit verification code to your phone.
                  </p>

                  <form onSubmit={handleSendOtp} className="mt-4 space-y-3 rounded-xl border border-neutral-200 bg-neutral-50/80 p-4">
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
                        Full Name (Optional)
                      </label>
                      <input
                        className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 focus:border-emerald-600 focus:outline-none"
                        value={phoneName}
                        onChange={(e) => setPhoneName(e.target.value)}
                        placeholder="Alex Rivera"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
                        Country &amp; Phone Number <span className="text-red-500">*</span>
                      </label>
                      <div className="mt-1 flex gap-2">
                        <select
                          value={countryCode}
                          onChange={(e) => setCountryCode(e.target.value)}
                          className="rounded-lg border border-neutral-300 bg-white px-2 py-2 text-xs text-neutral-900 focus:border-emerald-600 focus:outline-none font-medium shrink-0"
                        >
                          {COUNTRY_CODES.map((c) => (
                            <option key={c.code + c.country} value={c.code}>
                              {c.flag} {c.code}
                            </option>
                          ))}
                        </select>
                        <input
                          type="tel"
                          required
                          className="flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs text-neutral-900 focus:border-emerald-600 focus:outline-none"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          placeholder="e.g. 555 123 4567"
                        />
                      </div>
                    </div>

                    {error && <p className="text-xs text-red-600">{error}</p>}

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setPhoneModalOpen(false)}
                        className="rounded-lg border border-neutral-200 px-4 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-medium text-white shadow-sm hover:bg-emerald-700 transition-colors flex items-center gap-1.5"
                      >
                        <span>Send Code</span>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <>
                  <h2 className="text-base font-bold text-neutral-900 leading-snug">
                    Enter Verification Code
                  </h2>
                  <p className="mt-1 text-xs text-neutral-500">
                    Enter the 6-digit SMS code sent to <strong>{countryCode} {phoneNumber}</strong>.
                  </p>

                  <form onSubmit={handleVerifyOtp} className="mt-4 space-y-3 rounded-xl border border-neutral-200 bg-neutral-50/80 p-4">
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
                        6-Digit Security Code
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        required
                        autoFocus
                        className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-center text-lg font-mono tracking-widest text-neutral-900 focus:border-emerald-600 focus:outline-none"
                        value={phoneOtp}
                        onChange={(e) => setPhoneOtp(e.target.value)}
                        placeholder="123456"
                      />
                    </div>

                    {error && <p className="text-xs text-red-600">{error}</p>}

                    <div className="flex items-center justify-between pt-3 border-t border-neutral-200">
                      <button
                        type="button"
                        onClick={() => setPhoneStep("input")}
                        className="text-xs font-medium text-neutral-500 hover:text-neutral-800"
                      >
                        ← Change number
                      </button>
                      <button
                        type="submit"
                        className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-medium text-white shadow-sm hover:bg-emerald-700 transition-colors"
                      >
                        Verify &amp; Sign In
                      </button>
                    </div>
                  </form>
                </>
              )}
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

function GithubMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="shrink-0 text-neutral-900">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

function PhoneMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-emerald-600">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
