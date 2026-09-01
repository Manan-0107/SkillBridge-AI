"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useApp } from "@/lib/store";
import {
  startSpeechRecognition,
  SpeechRecognitionController,
  isSpeechRecognitionSupported,
  detectTextLanguage,
  setNativeInputValue,
  appendNativeInputValue,
  playAccessibleChime,
  speakText,
  stopSpeaking,
  SUPPORTED_LANGUAGES,
  setGlobalVoiceLanguage,
} from "@/lib/voice";

export function GlobalVoiceDictator() {
  const { voiceMode, voiceLanguage, setVoiceMode, setVoiceLanguage } = useApp();

  const [active, setActive] = useState(false);
  const [listening, setListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [focusedFieldLabel, setFocusedFieldLabel] = useState<string | null>(null);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [voiceBannerOpen, setVoiceBannerOpen] = useState(true);

  const controllerRef = useRef<SpeechRecognitionController | null>(null);
  const focusedElementRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const statusTimerRef = useRef<NodeJS.Timeout | null>(null);
  const initialAnnouncedRef = useRef(false);

  const showStatus = useCallback((msg: string, duration = 3000) => {
    setStatusMessage(msg);
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => {
      setStatusMessage(null);
    }, duration);
  }, []);

  // ─── 1. Track Active Focused Input / Textarea ───────────────────────────────
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) &&
        target.type !== "hidden" &&
        target.type !== "submit" &&
        target.type !== "button" &&
        target.type !== "checkbox" &&
        target.type !== "radio"
      ) {
        focusedElementRef.current = target;
        const label =
          target.getAttribute("aria-label") ||
          target.getAttribute("placeholder") ||
          target.name ||
          target.id ||
          (target instanceof HTMLTextAreaElement ? "Text Area" : `${target.type || "text"} field`);
        setFocusedFieldLabel(label);
      }
    };

    const handleFocusOut = () => {
      // Small timeout so clicking between inputs doesn't cause a flicker
      setTimeout(() => {
        const activeEl = document.activeElement;
        if (
          !activeEl ||
          !(activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement)
        ) {
          focusedElementRef.current = null;
          setFocusedFieldLabel(null);
        }
      }, 150);
    };

    window.addEventListener("focusin", handleFocusIn);
    window.addEventListener("focusout", handleFocusOut);

    return () => {
      window.removeEventListener("focusin", handleFocusIn);
      window.removeEventListener("focusout", handleFocusOut);
    };
  }, []);

  // ─── 2. Keyboard Shortcut (Alt + V) to Toggle Voice Anywhere ────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt + V to toggle voice dictation
      if (e.altKey && (e.key === "v" || e.key === "V")) {
        e.preventDefault();
        toggleVoiceDictation();
      }
      // Esc to silence speech / stop recognition
      if (e.key === "Escape" && active) {
        stopVoiceDictation();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active]);

  // ─── 3. Voice Command Parser & Smart Field Filler ───────────────────────────
  const processSpokenText = useCallback(
    (text: string, isFinal: boolean) => {
      const clean = text.trim();
      if (!clean) return;

      if (!isFinal) {
        setInterimTranscript(clean);
        return;
      }

      setInterimTranscript("");
      setLiveTranscript(clean);

      // Auto-detect language
      const detectedLang = detectTextLanguage(clean);
      if (detectedLang && detectedLang !== voiceLanguage) {
        setVoiceLanguage(detectedLang);
        setGlobalVoiceLanguage(detectedLang);
      }

      const lower = clean.toLowerCase();

      // ── Command A: "Clear" / "Erase" / "Reset"
      if (
        lower === "clear" ||
        lower === "clear input" ||
        lower === "erase" ||
        lower === "delete text" ||
        lower === "સાફ કરો" ||
        lower === "हटाओ"
      ) {
        if (focusedElementRef.current) {
          setNativeInputValue(focusedElementRef.current, "");
          playAccessibleChime("clear");
          showStatus("Field cleared");
        }
        return;
      }

      // ── Command B: "Submit" / "Login" / "Sign in" / "Save"
      if (
        lower === "submit" ||
        lower === "login" ||
        lower === "sign in" ||
        lower === "press enter" ||
        lower === "લૉગિન કરો" ||
        lower === "लॉगिन"
      ) {
        playAccessibleChime("success");
        // Try submitting closest form or active submit button
        if (focusedElementRef.current) {
          const form = focusedElementRef.current.form;
          if (form) {
            form.requestSubmit ? form.requestSubmit() : form.submit();
            showStatus("Form submitted");
            return;
          }
        }
        const submitBtn = document.querySelector<HTMLButtonElement>(
          'button[type="submit"], input[type="submit"], button#submit-btn'
        );
        if (submitBtn) {
          submitBtn.click();
          showStatus("Submitted");
          return;
        }
      }

      // ── Command C: "Scroll Down" / "Scroll Up" (Accessibility aid)
      if (lower.includes("scroll down") || lower.includes("નીચે સ્ક્રોલ")) {
        window.scrollBy({ top: 400, behavior: "smooth" });
        playAccessibleChime("navigate");
        return;
      }
      if (lower.includes("scroll up") || lower.includes("ઉપર સ્ક્રોલ")) {
        window.scrollBy({ top: -400, behavior: "smooth" });
        playAccessibleChime("navigate");
        return;
      }

      // ── Command D: Smart Target Filling (When no element is focused, or user explicitly specifies field)
      // e.g. "email john@example.com" or "name Alex Smith" or "password ..."
      const emailMatch = clean.match(/^(?:email|fill email|my email is|મારું ઈમેલ|ईमेल)\s+(.+)$/i);
      const passMatch = clean.match(/^(?:password|fill password|my password is|પાસવર્ડ|पासवर्ड)\s+(.+)$/i);
      const nameMatch = clean.match(/^(?:name|fill name|my name is|મારું નામ|नाम)\s+(.+)$/i);
      const searchMatch = clean.match(/^(?:search|find|શોધો|खोजो)\s+(.+)$/i);

      if (emailMatch) {
        const rawEmail = emailMatch[1].replace(/\s+at\s+/gi, "@").replace(/\s+dot\s+/gi, ".").replace(/\s+/g, "").toLowerCase();
        const emailInput = document.querySelector<HTMLInputElement>(
          'input[type="email"], input[name*="email" i], input[id*="email" i], input[placeholder*="email" i]'
        );
        if (emailInput) {
          emailInput.focus();
          setNativeInputValue(emailInput, rawEmail);
          playAccessibleChime("success");
          showStatus(`Filled Email: ${rawEmail}`);
          return;
        }
      }

      if (passMatch) {
        const passVal = passMatch[1].trim();
        const passInput = document.querySelector<HTMLInputElement>(
          'input[type="password"], input[name*="password" i], input[id*="password" i]'
        );
        if (passInput) {
          passInput.focus();
          setNativeInputValue(passInput, passVal);
          playAccessibleChime("success");
          showStatus("Filled Password");
          return;
        }
      }

      if (nameMatch) {
        const nameVal = nameMatch[1].trim();
        const nameInput = document.querySelector<HTMLInputElement>(
          'input[name*="name" i], input[id*="name" i], input[placeholder*="name" i]'
        );
        if (nameInput) {
          nameInput.focus();
          setNativeInputValue(nameInput, nameVal);
          playAccessibleChime("success");
          showStatus(`Filled Name: ${nameVal}`);
          return;
        }
      }

      if (searchMatch) {
        const searchVal = searchMatch[1].trim();
        const searchInput = document.querySelector<HTMLInputElement>(
          'input[type="search"], input[name*="search" i], input[id*="search" i], input[placeholder*="search" i]'
        );
        if (searchInput) {
          searchInput.focus();
          setNativeInputValue(searchInput, searchVal);
          playAccessibleChime("success");
          showStatus(`Searching: ${searchVal}`);
          return;
        }
      }

      // ── Standard Action: Fill into whatever input/textarea is currently focused
      let targetEl = focusedElementRef.current;
      if (!targetEl) {
        // If nothing explicitly focused, fallback to activeElement or the primary input on screen (like login email)
        const active = document.activeElement;
        if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
          targetEl = active;
        } else {
          // Check for any visible text input on screen
          targetEl = document.querySelector<HTMLInputElement>(
            'input[type="text"]:not([disabled]), input[type="email"]:not([disabled]), textarea:not([disabled])'
          );
        }
      }

      if (targetEl) {
        targetEl.focus();
        appendNativeInputValue(targetEl, clean, "append");
        playAccessibleChime("success");
        const label =
          targetEl.getAttribute("aria-label") ||
          targetEl.placeholder ||
          targetEl.name ||
          "Active Field";
        showStatus(`Filled: "${clean.slice(0, 24)}${clean.length > 24 ? "…" : ""}" into ${label}`);
      }
    },
    [voiceLanguage, setVoiceLanguage, showStatus]
  );

  // ─── 4. Start & Stop Voice Engine ───────────────────────────────────────────
  const startVoiceDictation = useCallback(() => {
    if (!isSpeechRecognitionSupported()) {
      showStatus("Speech recognition is not supported in this browser. Please use Chrome/Edge.", 5000);
      return;
    }

    controllerRef.current?.stop();
    playAccessibleChime("start");
    setActive(true);
    setVoiceMode(true);

    const controller = startSpeechRecognition(
      {
        onTranscript: (transcript, isFinal) => {
          processSpokenText(transcript, isFinal);
        },
        onListeningChange: (isList) => {
          setListening(isList);
        },
        onError: (err) => {
          console.warn("[VoiceDictator] Error:", err);
          setListening(false);
        },
      },
      { lang: voiceLanguage, continuous: true }
    );

    controllerRef.current = controller;
    showStatus("🎙️ Voice Dictation Active — Speak into any box", 3500);
  }, [voiceLanguage, setVoiceMode, processSpokenText, showStatus]);

  const stopVoiceDictation = useCallback(() => {
    playAccessibleChime("stop");
    controllerRef.current?.stop();
    controllerRef.current = null;
    setActive(false);
    setListening(false);
    setLiveTranscript("");
    setInterimTranscript("");
    stopSpeaking();
    showStatus("Voice dictation paused", 2000);
  }, [showStatus]);

  const toggleVoiceDictation = () => {
    if (active) {
      stopVoiceDictation();
    } else {
      startVoiceDictation();
    }
  };

  // ─── 5. Initial Load Accessibility Audio Cue for Disabled / Blind Users ─────
  useEffect(() => {
    if (!initialAnnouncedRef.current && isSpeechRecognitionSupported()) {
      initialAnnouncedRef.current = true;
      // If voiceMode was previously enabled or first session, auto-engage
      if (voiceMode) {
        const t = setTimeout(() => {
          startVoiceDictation();
        }, 1200);
        return () => clearTimeout(t);
      }
    }
  }, [voiceMode, startVoiceDictation]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      controllerRef.current?.stop();
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    };
  }, []);

  return (
    <>
      {/* Invisible Screen Reader Announcement Region */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {statusMessage || (active ? "Voice dictation is active" : "Voice dictation is off")}
      </div>

      {/* Floating Accessibility Voice HUD Pill */}
      <aside
        role="region"
        aria-label="Universal Voice Input and Accessibility Controls"
        className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2 pointer-events-auto select-none"
      >
        {/* Live Transcript / Feedback Popover */}
        {(active || statusMessage || interimTranscript || liveTranscript) && voiceBannerOpen && (
          <div
            className={`max-w-sm rounded-2xl border p-3.5 shadow-xl backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-2 ${
              active
                ? "border-indigo-300/80 bg-white/95 text-neutral-900 shadow-indigo-500/10 ring-1 ring-indigo-500/20"
                : "border-neutral-200 bg-white/95 text-neutral-800"
            }`}
          >
            <div className="flex items-center justify-between gap-2 border-b border-neutral-100 pb-2 mb-2">
              <div className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${active ? "bg-emerald-500 animate-pulse" : "bg-neutral-400"}`} />
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-700">
                  {active ? "🎙️ Universal Voice Fill Active" : "Voice Assistant"}
                </span>
              </div>

              <div className="flex items-center gap-1">
                {/* Language Picker Toggle */}
                <button
                  type="button"
                  onClick={() => setShowLanguagePicker(!showLanguagePicker)}
                  className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-colors cursor-pointer"
                  title="Change voice recognition language"
                >
                  🌐 {SUPPORTED_LANGUAGES.find((l) => l.code === voiceLanguage)?.flag || "🇮🇳"}
                </button>
                <button
                  type="button"
                  onClick={() => setVoiceBannerOpen(false)}
                  className="text-neutral-400 hover:text-neutral-600 text-xs px-1"
                  aria-label="Minimize voice banner"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Language Selection Dropdown */}
            {showLanguagePicker && (
              <div className="mb-2 max-h-36 overflow-y-auto rounded-lg border border-neutral-200 bg-neutral-50 p-1 text-xs space-y-0.5">
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => {
                      setVoiceLanguage(lang.code);
                      setGlobalVoiceLanguage(lang.code);
                      setShowLanguagePicker(false);
                      showStatus(`Language set to ${lang.nativeName}`);
                      if (active) {
                        startVoiceDictation();
                      }
                    }}
                    className={`flex w-full items-center justify-between rounded px-2 py-1 text-left transition-colors cursor-pointer ${
                      voiceLanguage === lang.code
                        ? "bg-indigo-600 font-bold text-white"
                        : "text-neutral-700 hover:bg-neutral-200"
                    }`}
                  >
                    <span>{lang.flag} {lang.nativeName}</span>
                    <span className="text-[10px] opacity-75">{lang.name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Active Target Field Info */}
            {focusedFieldLabel ? (
              <p className="text-[11px] font-semibold text-indigo-700 bg-indigo-50/80 px-2 py-1 rounded-md mb-1.5 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                Target Box: <span className="underline font-bold">{focusedFieldLabel}</span>
              </p>
            ) : (
              <p className="text-[11px] text-neutral-500 mb-1.5">
                💡 Click any input or say <em>&quot;email ...&quot;</em> / <em>&quot;name ...&quot;</em>
              </p>
            )}

            {/* Live Audio Transcript Preview */}
            <div className="min-h-[24px] rounded-lg bg-neutral-50 border border-neutral-100 p-2 text-xs">
              {interimTranscript ? (
                <p className="text-neutral-500 italic flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                  &quot;{interimTranscript}&quot;
                </p>
              ) : liveTranscript ? (
                <p className="font-medium text-emerald-800">
                  🗣️ &quot;{liveTranscript}&quot;
                </p>
              ) : statusMessage ? (
                <p className="text-neutral-700 font-medium">{statusMessage}</p>
              ) : (
                <p className="text-neutral-400 italic">Listening for your speech across the screen...</p>
              )}
            </div>

            {/* Audio Wave Visualizer while actively listening */}
            {active && listening && (
              <div className="mt-2 flex items-center justify-center gap-1 h-3">
                <span className="h-2 w-1 rounded-full bg-indigo-500 animate-pulse" />
                <span className="h-3.5 w-1 rounded-full bg-indigo-600 animate-pulse delay-75" />
                <span className="h-2.5 w-1 rounded-full bg-indigo-500 animate-pulse delay-150" />
                <span className="h-1.5 w-1 rounded-full bg-indigo-400 animate-pulse" />
              </div>
            )}
          </div>
        )}

        {/* Master Microphone Floating Toggle Button */}
        <div className="flex items-center gap-2">
          {!voiceBannerOpen && (
            <button
              type="button"
              onClick={() => setVoiceBannerOpen(true)}
              className="rounded-full bg-white border border-neutral-200 px-2.5 py-1 text-xs font-semibold text-neutral-700 shadow-md hover:bg-neutral-50 cursor-pointer"
            >
              Show Voice HUD
            </button>
          )}

          <button
            type="button"
            onClick={toggleVoiceDictation}
            aria-label={active ? "Deactivate voice dictation (Alt+V)" : "Activate universal voice dictation (Alt+V)"}
            title={active ? "Voice Fill Active (Click or Alt+V to Pause)" : "Enable Universal Voice Fill (Alt+V)"}
            className={`group relative flex h-13 w-13 items-center justify-center rounded-full shadow-2xl transition-all transform active:scale-95 cursor-pointer ${
              active
                ? "bg-gradient-to-tr from-indigo-600 to-violet-600 text-white ring-4 ring-indigo-500/30 scale-105 shadow-indigo-500/40"
                : "bg-white border-2 border-neutral-300 text-neutral-700 hover:border-indigo-500 hover:text-indigo-600 shadow-lg"
            }`}
          >
            {active ? (
              <>
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white" />
                </span>
                <span className="text-2xl animate-pulse">🎙️</span>
              </>
            ) : (
              <span className="text-xl group-hover:scale-110 transition-transform">🎤</span>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
