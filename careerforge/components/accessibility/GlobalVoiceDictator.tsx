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
  isAIAudioPlaying,
  normalizeSpokenEmail,
  getFieldPromptMessage,
} from "@/lib/voice";

export function GlobalVoiceDictator() {
  const {
    user,
    voiceMode,
    voiceLanguage,
    setVoiceMode,
    setVoiceLanguage,
    accessibilityPrefs,
    setAccessibilityPrefs,
    currentLocation,
    userSkills,
    missingSkills,
  } = useApp();

  const [active, setActive] = useState(false);
  const [listening, setListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [focusedFieldLabel, setFocusedFieldLabel] = useState<string | null>(null);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [voiceBannerOpen, setVoiceBannerOpen] = useState(true);

  // ─── Interactive AI Voice Agent Dialogue State ──────────────────────────────
  const [aiSpeechPrompt, setAiSpeechPrompt] = useState<string | null>(null);
  const [pendingFieldTarget, setPendingFieldTarget] = useState<"email" | "name" | "password" | "search" | "general" | null>(null);
  const [isAiAnswering, setIsAiAnswering] = useState(false);

  const controllerRef = useRef<SpeechRecognitionController | null>(null);
  const focusedElementRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const statusTimerRef = useRef<NodeJS.Timeout | null>(null);
  const initialAnnouncedRef = useRef(false);
  const currentLangRef = useRef(voiceLanguage);
  currentLangRef.current = voiceLanguage;

  const showStatus = useCallback((msg: string, duration = 3500) => {
    setStatusMessage(msg);
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => {
      setStatusMessage(null);
    }, duration);
  }, []);

  // ─── 1. Track Active Focused Input / Textarea & Prompt User to Speak ─────────
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

        // Whenever a field is live/focused, ask the user to speak for that field!
        const prompt = getFieldPromptMessage(label, target.type, currentLangRef.current);
        setAiSpeechPrompt(prompt);
        showStatus("🎙️ " + prompt, 4000);
        playAccessibleChime("focus");
        if (accessibilityPrefs?.speechOutput !== false) {
          speakText(prompt, { lang: currentLangRef.current });
        }
      }
    };

    const handleFocusOut = () => {
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
      if (e.altKey && (e.key === "v" || e.key === "V")) {
        e.preventDefault();
        toggleVoiceDictation();
      }
      if (e.key === "Escape" && active) {
        stopVoiceDictation();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // ─── 3. Ask AI Agent for Dynamic Assistance in the User's Language ──────────
  const askAiAssistant = useCallback(
    async (userQuestion: string, detectedLang: string) => {
      setIsAiAnswering(true);
      try {
        const res = await fetch("/api/assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", text: userQuestion }],
            userProfile: {
              name: user?.name,
              email: user?.email,
              targetRole: user?.targetRole || undefined,
              skills: userSkills,
              missingSkills,
              location: currentLocation || undefined,
            },
            targetRole: user?.targetRole || "Software Engineer",
            voiceMode: true,
            accessibilityPrefs,
          }),
        });
        const data = await res.json();

        if (data.toolCall && data.toolCall.tool === "updateAccessibilityPreferences" && data.toolCall.parameters) {
          setAccessibilityPrefs(data.toolCall.parameters);
        }

        const replyText = data.reply || "";

        if (replyText) {
          setAiSpeechPrompt(replyText);
          showStatus(`🤖 ${replyText.slice(0, 50)}...`, 5000);
          if (accessibilityPrefs?.speechOutput !== false) {
            speakText(replyText, {
              lang: detectedLang,
              onEnd: () => {
                setIsAiAnswering(false);
              },
            });
          } else {
            setIsAiAnswering(false);
          }
        }
      } catch (err) {
        console.warn("[VoiceAgent] AI query error:", err);
      } finally {
        setIsAiAnswering(false);
      }
    },
    [user, userSkills, missingSkills, currentLocation, accessibilityPrefs, setAccessibilityPrefs, showStatus]
  );

  // ─── 4. Voice Command Parser & Multilingual Form Filler ─────────────────────
  const processSpokenText = useCallback(
    (text: string, isFinal: boolean) => {
      // ── Acoustic Echo Cancellation Guard: Discard all audio while AI is speaking
      if (isAIAudioPlaying()) {
        return;
      }

      const clean = text.trim();
      if (!clean) return;

      if (!isFinal) {
        setInterimTranscript(clean);
        return;
      }

      setInterimTranscript("");
      setLiveTranscript(clean);

      // Auto-detect spoken language (Gujarati, Hindi, Spanish, English, etc.)
      const detectedLang = detectTextLanguage(clean);
      if (detectedLang && detectedLang !== currentLangRef.current) {
        setVoiceLanguage(detectedLang);
        setGlobalVoiceLanguage(detectedLang);
        currentLangRef.current = detectedLang;
      }

      const lower = clean.toLowerCase();
      const isGujarati = detectedLang === "gu-IN" || /[\u0A80-\u0AFF]/.test(clean);
      const isHindi = detectedLang === "hi-IN" || /[\u0900-\u097F]/.test(clean);

      // ── Command A: "Clear" / "Erase" / "Reset" / "સાફ કરો"
      if (
        lower === "clear" ||
        lower === "clear input" ||
        lower === "erase" ||
        lower === "delete text" ||
        lower === "સાફ કરો" ||
        lower === "દૂર કરો" ||
        lower === "हटाओ" ||
        lower === "साफ़ करो"
      ) {
        if (focusedElementRef.current) {
          setNativeInputValue(focusedElementRef.current, "");
          playAccessibleChime("clear");
          showStatus(isGujarati ? "ખાનું સાફ કર્યું" : isHindi ? "साफ़ किया गया" : "Field cleared");
        }
        return;
      }

      // ── Command B: "Submit" / "Login" / "Sign in" / "Save" / "લૉગિન કરો"
      if (
        lower === "submit" ||
        lower === "login" ||
        lower === "sign in" ||
        lower === "press enter" ||
        lower === "લૉગિન કરો" ||
        lower === "સબમિટ કરો" ||
        lower === "लॉगिन" ||
        lower === "सबमिट"
      ) {
        playAccessibleChime("success");
        if (focusedElementRef.current) {
          const form = focusedElementRef.current.form;
          if (form) {
            form.requestSubmit ? form.requestSubmit() : form.submit();
            showStatus(isGujarati ? "સબમિટ કર્યું" : "Form submitted");
            return;
          }
        }
        const submitBtn = document.querySelector<HTMLButtonElement>(
          'button[type="submit"], input[type="submit"], button#submit-btn'
        );
        if (submitBtn) {
          submitBtn.click();
          showStatus(isGujarati ? "સબમિટ કર્યું" : "Submitted");
          return;
        }
      }

      // ── Command C: "Help" / "મદદ" / "મારે શું કરવું?" / "What should I do?"
      if (
        lower === "help" ||
        lower === "help me" ||
        lower.includes("મદદ") ||
        lower.includes("શું કરવું") ||
        lower.includes("કેવી રીતે") ||
        lower.includes("सहायता") ||
        lower.includes("मदद") ||
        lower.includes("क्या करूँ")
      ) {
        let helpPrompt = "I am CareerForge AI. Tell me your name, email, or any question, and I will guide you.";
        if (isGujarati) {
          helpPrompt = "નમસ્તે! હું કરિયરફોર્જ AI સહાયક છું. તમારું નામ, ઈમેઇલ અથવા કોઈ પ્રશ્ન પૂછો, હું તરત મદદ કરીશ.";
        } else if (isHindi) {
          helpPrompt = "नमस्ते! मैं करियरफोर्ज AI सहायक हूँ। अपना नाम, ईमेल या कोई भी प्रश्न पूछें, मैं तुरंत सहायता करूँगा।";
        }
        setAiSpeechPrompt(helpPrompt);
        speakText(helpPrompt, { lang: detectedLang });
        showStatus(helpPrompt, 6000);
        return;
      }

      // ── Command D: Scroll Down / Scroll Up (Accessibility aid)
      if (lower.includes("scroll down") || lower.includes("નીચે સ્ક્રોલ") || lower.includes("नीचे स्क्रॉल")) {
        window.scrollBy({ top: 400, behavior: "smooth" });
        playAccessibleChime("navigate");
        return;
      }
      if (lower.includes("scroll up") || lower.includes("ઉપર સ્ક્રોલ") || lower.includes("ऊपर स्क्रॉल")) {
        window.scrollBy({ top: -400, behavior: "smooth" });
        playAccessibleChime("navigate");
        return;
      }

      // ── Command E: Live Focused Field Filling or Pending AI Prompt ──────────
      if (focusedElementRef.current) {
        const target = focusedElementRef.current;
        const isEmailField =
          target.type === "email" ||
          (target.name && target.name.toLowerCase().includes("email")) ||
          (target.id && target.id.toLowerCase().includes("email")) ||
          (target.placeholder && target.placeholder.toLowerCase().includes("email")) ||
          lower.includes("@") ||
          lower.includes("at the rate") ||
          lower.includes("at rate") ||
          lower.includes("એટ ધ રેટ") ||
          lower.includes("एट द रेट") ||
          lower.includes("gmail") ||
          lower.includes(".com");

        if (isEmailField) {
          const rawEmail = normalizeSpokenEmail(clean);
          setNativeInputValue(target, rawEmail);
          playAccessibleChime("success");
          const ack = isGujarati
            ? `ઈમેઇલ ${rawEmail} ભરાઈ ગયું છે.`
            : isHindi
            ? `ईमेल ${rawEmail} दर्ज कर दिया गया है।`
            : `Email entered: ${rawEmail}`;
          showStatus(`✅ ${ack}`, 4000);
          return;
        }

        // Generic text / number / search / role input field
        setNativeInputValue(target, clean);
        playAccessibleChime("success");
        const ack = isGujarati ? `ભરાઈ ગયું: ${clean}` : isHindi ? `दर्ज हुआ: ${clean}` : `Entered: ${clean}`;
        showStatus(`✅ ${ack}`, 3500);
        return;
      }

      // ── Command F: Targeted Voice Commands (Email / Password / Name / Search)
      const emailMatch = clean.match(/^(?:email|fill email|my email is|મારું ઈમેલ|મારું ઈમેઈલ|ઈમેલ|ईमेल)\s+(.+)$/i);
      const passMatch = clean.match(/^(?:password|fill password|my password is|પાસવર્ડ|पासवर्ड)\s+(.+)$/i);
      const nameMatch = clean.match(/^(?:name|fill name|my name is|મારું નામ|नाम)\s+(.+)$/i);
      const searchMatch = clean.match(/^(?:search|find|શોધો|ખોજો|खोजो)\s+(.+)$/i);

      if (emailMatch || lower.includes("@") || lower.includes("at the rate") || lower.includes("gmail") || lower.includes(".com")) {
        const rawEmail = normalizeSpokenEmail(emailMatch ? emailMatch[1] : clean);
        const emailInput = document.querySelector<HTMLInputElement>(
          'input[type="email"], input[name*="email" i], input[id*="email" i], input[placeholder*="email" i]'
        );
        if (emailInput) {
          emailInput.focus();
          setNativeInputValue(emailInput, rawEmail);
          playAccessibleChime("success");
          const ack = isGujarati ? `ઈમેઇલ ભરાઈ ગયું: ${rawEmail}` : `Email filled: ${rawEmail}`;
          showStatus(`✅ ${ack}`, 4000);
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
          showStatus(isGujarati ? "પાસવર્ડ ભરાઈ ગયો" : "Filled Password");
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
          showStatus(isGujarati ? `નામ ભરાઈ ગયું: ${nameVal}` : `Filled Name: ${nameVal}`);
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
          showStatus(isGujarati ? `શોધી રહ્યા છીએ: ${searchVal}` : `Searching: ${searchVal}`);
          return;
        }
      }

      // ── Command G: If User is Asking a Question to the AI (Conversational Guidance)
      const isQuestion =
        lower.endsWith("?") ||
        lower.startsWith("what") ||
        lower.startsWith("how") ||
        lower.startsWith("why") ||
        lower.startsWith("can you") ||
        lower.startsWith("explain") ||
        lower.startsWith("tell me") ||
        lower.includes("શું") ||
        lower.includes("કેવી રીતે") ||
        lower.includes("સમજાવો") ||
        lower.includes("બતાવો") ||
        lower.includes("कैसे") ||
        lower.includes("क्या");

      if (isQuestion && !focusedElementRef.current) {
        askAiAssistant(clean, detectedLang);
        return;
      }

      // ── Standard Action: Type directly into focused element or primary screen input
      let targetEl = focusedElementRef.current;
      if (!targetEl) {
        const active = document.activeElement;
        if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
          targetEl = active;
        } else {
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
      } else {
        // If no field found and not answered above, treat as conversational guidance
        askAiAssistant(clean, detectedLang);
      }
    },
    [user, pendingFieldTarget, askAiAssistant, setVoiceLanguage, showStatus]
  );

  // ─── 5. Start & Stop Voice Engine ───────────────────────────────────────────
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
        onTranscript: (transcript: string, isFinal?: boolean) => {
          if (isAIAudioPlaying()) return;
          processSpokenText(transcript, !!isFinal);
        },
        onListeningChange: (isList: boolean) => {
          setListening(isList);
        },
        onError: (err: string) => {
          console.warn("[VoiceDictator] Error:", err);
          setListening(false);
        },
      },
      { lang: currentLangRef.current || "en-US", continuous: true }
    );

    controllerRef.current = controller;

    // Speak initial welcome guidance prompt if on login
    if (!user && !initialAnnouncedRef.current) {
      initialAnnouncedRef.current = true;
      const isGu = currentLangRef.current === "gu-IN";
      const isHi = currentLangRef.current === "hi-IN";
      const welcome = isGu
        ? "કરિયરફોર્જ AI સક્રિય છે. તમારું ઈમેઇલ અથવા નામ જણાવો, હું આપમેળે ભરી દઈશ."
        : isHi
        ? "करियरफोर्ज AI सक्रिय है। अपना ईमेल या नाम बताएं, मैं स्वतः भर दूँगा।"
        : "CareerForge AI is active. Speak your email or name, and I will fill it in for you.";
      setAiSpeechPrompt(welcome);
      setPendingFieldTarget("email");
      speakText(welcome, { lang: currentLangRef.current || "en-US" });
    }

    showStatus("🎙️ Voice Dictation Active — Speak in any language", 3500);
  }, [user, setVoiceMode, processSpokenText, showStatus]);

  const stopVoiceDictation = useCallback(() => {
    playAccessibleChime("stop");
    controllerRef.current?.stop();
    controllerRef.current = null;
    setActive(false);
    setListening(false);
    setLiveTranscript("");
    setInterimTranscript("");
    setAiSpeechPrompt(null);
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

  // ─── 6. Auto-Engage Voice Mode if Enabled ───────────────────────────────────
  useEffect(() => {
    if (voiceMode && !active && isSpeechRecognitionSupported()) {
      const t = setTimeout(() => {
        startVoiceDictation();
      }, 1000);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceMode]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      controllerRef.current?.stop();
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    };
  }, []);

  const currentLangObj =
    SUPPORTED_LANGUAGES.find((l) => l.code === voiceLanguage) || SUPPORTED_LANGUAGES[0];

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
        {/* Live Transcript / AI Prompt Popover */}
        {(active || liveTranscript || interimTranscript || aiSpeechPrompt) && voiceBannerOpen && (
          <div className="mb-2 max-w-sm rounded-2xl border border-neutral-200 bg-white/95 p-4 shadow-2xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between gap-2 border-b border-neutral-100 pb-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  {isAiAnswering ? "AI Answering..." : listening ? "Listening..." : "Voice Ready"}
                </span>
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-700 border border-neutral-200">
                  {currentLangObj.flag} {currentLangObj.nativeName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setVoiceBannerOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 text-xs px-1"
                aria-label="Minimize Voice HUD"
              >
                ✕
              </button>
            </div>

            {/* AI Assistant Guidance Prompt */}
            {aiSpeechPrompt && (
              <div className="mb-2 rounded-xl bg-neutral-900 p-2.5 text-xs text-white shadow-xs">
                <div className="flex items-center gap-1.5 font-semibold text-[11px] text-emerald-400 mb-1">
                  <span>🤖 AI Assistant Guide:</span>
                </div>
                <p className="leading-relaxed">{aiSpeechPrompt}</p>
              </div>
            )}

            {/* Live Spoken Transcript */}
            <div className="text-xs text-neutral-800 font-medium leading-relaxed min-h-[20px]">
              {liveTranscript && <p className="text-neutral-900 font-semibold">{liveTranscript}</p>}
              {interimTranscript && (
                <p className="text-neutral-500 italic animate-pulse">{interimTranscript} ...</p>
              )}
              {!liveTranscript && !interimTranscript && !aiSpeechPrompt && (
                <p className="text-neutral-400 italic">Speak in Gujarati, Hindi, English, etc. to fill any field or ask questions...</p>
              )}
            </div>

            {/* Focused Target Field Indicator */}
            {focusedFieldLabel && (
              <div className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-neutral-50 px-2.5 py-1 text-[11px] font-medium text-neutral-600 border border-neutral-200/60">
                <span>🎯 Target:</span>
                <span className="font-semibold text-neutral-900 truncate max-w-[180px]">
                  {focusedFieldLabel}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Floating Action Bar */}
        <div className="flex items-center gap-2 rounded-full border border-neutral-300 bg-white/95 px-3.5 py-2 shadow-xl backdrop-blur-md">
          {/* Main Microphone Button */}
          <button
            type="button"
            onClick={toggleVoiceDictation}
            className={`group flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 cursor-pointer ${
              active
                ? "bg-rose-600 text-white shadow-md hover:bg-rose-700 animate-pulse"
                : "bg-neutral-900 text-white shadow-sm hover:bg-neutral-800"
            }`}
            title="Toggle Voice Dictation & AI Assistant (Alt + V)"
            aria-pressed={active}
          >
            <span className="text-sm">{active ? "🛑" : "🎙️"}</span>
            <span>{active ? "Listening (Alt+V)" : "Voice Start"}</span>
          </button>

          {/* Quick Help Button */}
          <button
            type="button"
            onClick={() => {
              if (!active) startVoiceDictation();
              const isGu = voiceLanguage === "gu-IN";
              const msg = isGu
                ? "હું તમારી શું મદદ કરી શકું? તમારો પ્રશ્ન પૂછો અથવા ફોર્મ ભરવા માટે બોલો."
                : "How can I help you? Ask any question or speak to fill forms.";
              setAiSpeechPrompt(msg);
              speakText(msg, { lang: voiceLanguage });
            }}
            className="flex items-center gap-1 rounded-full bg-neutral-100 hover:bg-neutral-200 px-2.5 py-1.5 text-xs font-semibold text-neutral-800 border border-neutral-200 cursor-pointer transition-colors"
            title="Ask AI Assistant for Help (મદદ)"
          >
            <span>💡</span>
            <span>Help</span>
          </button>

          {/* Language Selector Dropdown Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowLanguagePicker(!showLanguagePicker)}
              className="flex items-center gap-1 rounded-full bg-neutral-100 hover:bg-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-800 border border-neutral-200 cursor-pointer transition-colors"
              title="Change Voice Recognition Language"
            >
              <span>{currentLangObj.flag}</span>
              <span className="hidden sm:inline font-semibold">{currentLangObj.nativeName}</span>
              <span className="text-[10px] text-neutral-500">▼</span>
            </button>

            {/* Language Selector Menu */}
            {showLanguagePicker && (
              <div className="absolute bottom-full right-0 mb-2 w-52 max-h-64 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-1.5 shadow-2xl z-50">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-neutral-500 border-b border-neutral-100 mb-1">
                  Select Language (ભાષા)
                </div>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => {
                      setVoiceLanguage(lang.code);
                      setGlobalVoiceLanguage(lang.code);
                      currentLangRef.current = lang.code;
                      setShowLanguagePicker(false);
                      showStatus(`Language switched to ${lang.nativeName}`, 3000);
                      if (active) {
                        // Restart recognition with new language
                        controllerRef.current?.stop();
                        const controller = startSpeechRecognition(
                          {
                            onTranscript: (transcript: string, isFinal?: boolean) => {
                              processSpokenText(transcript, !!isFinal);
                            },
                            onListeningChange: (isList: boolean) => setListening(isList),
                            onError: (err: string) => console.warn(err),
                          },
                          { lang: lang.code, continuous: true }
                        );
                        controllerRef.current = controller;
                      }
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-left cursor-pointer transition-colors ${
                      voiceLanguage === lang.code
                        ? "bg-neutral-900 text-white font-semibold"
                        : "text-neutral-700 hover:bg-neutral-100"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{lang.flag}</span>
                      <span>{lang.nativeName}</span>
                    </span>
                    <span className="text-[10px] text-neutral-400">{lang.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
