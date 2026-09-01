"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useApp } from "@/lib/store";
import { FeatureId, ResumeTab } from "@/lib/intent";
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
  isSpeaking,
  SUPPORTED_LANGUAGES,
  setGlobalVoiceLanguage,
  isAIAudioPlaying,
  normalizeSpokenEmail,
  normalizeSpokenName,
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
  const wasActiveBeforeBlurRef = useRef(false);
  const pendingNameVerificationRef = useRef<string | null>(null);
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
          speakText(prompt, {
            lang: currentLangRef.current,
            onEnd: () => {
              if (!active) {
                toggleVoiceDictation();
              }
            },
          });
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
      // ── Instant Barge-In / Interruption: cancel AI speech when user speaks ──
      if (isSpeaking()) {
        stopSpeaking();
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

      // ── Strict Background Audio Guard: Discard all audio if tab is hidden / in background
      if (typeof document !== "undefined" && document.hidden) {
        return;
      }

      // ── Top Priority: Name Confirmation Response ("Yes" / "Correct" / "હા" / "हाँ")
      if (pendingNameVerificationRef.current) {
        const isYes =
          lower === "yes" ||
          lower === "correct" ||
          lower === "yeah" ||
          lower === "yep" ||
          lower === "sure" ||
          lower === "right" ||
          lower === "ok" ||
          lower === "okay" ||
          lower === "continue" ||
          lower.includes("yes") ||
          lower.includes("correct") ||
          lower.includes("સાચું") ||
          lower.includes("હા") ||
          lower.includes("हाँ") ||
          lower.includes("सही") ||
          lower.includes("બરાબર");

        const isNo =
          lower === "no" ||
          lower === "wrong" ||
          lower === "incorrect" ||
          lower === "change" ||
          lower === "ના" ||
          lower === "નહીં" ||
          lower === "नहीं" ||
          lower === "गलत";

        if (isYes) {
          const confirmedName = pendingNameVerificationRef.current;
          pendingNameVerificationRef.current = null;
          playAccessibleChime("success");

          const nextEmail = document.querySelector<HTMLInputElement>(
            '#auth-email-input, input[type="email"], input[name*="email" i], input[id*="email" i]'
          );
          if (nextEmail) {
            nextEmail.focus();
            focusedElementRef.current = nextEmail;
            setPendingFieldTarget("email");
          }

          const nextMsg = isGujarati
            ? `નામ ${confirmedName} કન્ફર્મ થયું! સ્ટેપ ૨: કૃપા કરીને તમારું ઈમેઇલ સરનામું બોલો.`
            : isHindi
            ? `नाम ${confirmedName} की पुष्टि हुई! स्टेप २: कृपया अपना ईमेल पता बोलें।`
            : `Name confirmed as ${confirmedName}! Step 2 of 3: Please speak your email address.`;

          setAiSpeechPrompt(nextMsg);
          speakText(nextMsg, { lang: currentLangRef.current });
          showStatus(`🎙️ ${nextMsg}`, 4500);
          return;
        }

        if (isNo) {
          pendingNameVerificationRef.current = null;
          const nameInput = document.querySelector<HTMLInputElement>('#auth-name-input');
          if (nameInput) {
            nameInput.focus();
            focusedElementRef.current = nameInput;
            setNativeInputValue(nameInput, "");
          }
          const retryMsg = isGujarati
            ? "કૃપા કરીને તમારું પૂરું નામ ફરીથી બોલો."
            : isHindi
            ? "कृपया अपना पूरा नाम दोबारा बोलें।"
            : "Please speak your full name again.";
          setAiSpeechPrompt(retryMsg);
          speakText(retryMsg, { lang: currentLangRef.current });
          showStatus(`🎙️ ${retryMsg}`, 3500);
          return;
        }
      }

      // ── Command 0A: "Go Back" / "Previous" / "Go to previous section"
      const isGoBack =
        lower === "go back" ||
        lower === "back" ||
        lower === "previous" ||
        lower === "previous section" ||
        lower === "go to previous section" ||
        lower === "go to previous" ||
        lower.includes("go back") ||
        lower.includes("previous section") ||
        lower === "પાછળ જાઓ" ||
        lower === "પાછળ" ||
        lower === "પીછે જાઓ" ||
        lower === "પીછે" ||
        lower === "retour";

      if (isGoBack) {
        playAccessibleChime("navigate");

        // If on AuthGate step:
        const passInput = document.querySelector<HTMLInputElement>('#auth-password-input');
        const emailInput = document.querySelector<HTMLInputElement>('#auth-email-input');
        const nameInput = document.querySelector<HTMLInputElement>('#auth-name-input');

        if (focusedElementRef.current === passInput || pendingFieldTarget === "password") {
          if (emailInput) {
            emailInput.focus();
            focusedElementRef.current = emailInput;
            setPendingFieldTarget("email");
            const msg = isGujarati ? "પાછળ ગયા: ઈમેઇલ સરનામું. કૃપા કરીને તમારું ઈમેઇલ બોલો." : isHindi ? "पीछे गए: ईमेल पता। कृपया अपना ईमेल बोलें।" : "Going back to Email Address. Please speak your email address.";
            setAiSpeechPrompt(msg);
            speakText(msg, { lang: currentLangRef.current });
            showStatus(`🎙️ ${msg}`, 3500);
            return;
          }
        } else if (focusedElementRef.current === emailInput || pendingFieldTarget === "email") {
          if (nameInput) {
            nameInput.focus();
            focusedElementRef.current = nameInput;
            setPendingFieldTarget("name");
            const msg = isGujarati ? "પાછળ ગયા: પૂરું નામ. કૃપા કરીને તમારું નામ બોલો." : isHindi ? "पीछे गए: पूरा नाम। कृपया अपना नाम बोलें।" : "Going back to Full Name. Please speak your full name.";
            setAiSpeechPrompt(msg);
            speakText(msg, { lang: currentLangRef.current });
            showStatus(`🎙️ ${msg}`, 3500);
            return;
          }
        }

        // If on Workspace -> Navigate back to Assistant
        window.dispatchEvent(new CustomEvent("careerforge:navigate", { detail: { feature: "assistant" } }));
        const backMsg = isGujarati ? "પાછળ મુખ્ય પેજ પર આવ્યા." : isHindi ? "पीछे मुख्य पेज पर वापस आए।" : "Navigated back to Assistant.";
        setAiSpeechPrompt(backMsg);
        speakText(backMsg, { lang: currentLangRef.current });
        showStatus(`🚀 ${backMsg}`, 3500);
        return;
      }

      // ── Command 0B: Step Rewind / Jump ("go to full name again", "change email", "go to pin again")
      const isJumpName =
        lower.includes("go to full name") ||
        lower.includes("full name section") ||
        lower.includes("change full name") ||
        lower.includes("change name") ||
        lower.includes("full name again") ||
        lower.includes("નામ બદલવું") ||
        lower.includes("નામ પર જાઓ") ||
        lower.includes("नाम बदलना") ||
        lower.includes("नाम पर जाओ");

      const isJumpEmail =
        lower.includes("go to email") ||
        lower.includes("email section") ||
        lower.includes("change email") ||
        lower.includes("email again") ||
        lower.includes("ઈમેઇલ બદલવું") ||
        lower.includes("ઈમેઇલ પર જાઓ") ||
        lower.includes("ईमेल बदलना") ||
        lower.includes("ईमेल पर जाओ");

      const isJumpPin =
        lower.includes("go to pin") ||
        lower.includes("go to password") ||
        lower.includes("change pin") ||
        lower.includes("change password") ||
        lower.includes("pin again") ||
        lower.includes("password again") ||
        lower.includes("પાસવર્ડ બદલવો") ||
        lower.includes("પાસવર્ડ પર જાઓ") ||
        lower.includes("पासवर्ड बदलना") ||
        lower.includes("पासवर्ड पर जाओ");

      if (isJumpName) {
        const nameInput = document.querySelector<HTMLInputElement>(
          '#auth-name-input, input[name*="name" i], input[id*="name" i], input[placeholder*="name" i]'
        );
        if (nameInput) {
          nameInput.focus();
          focusedElementRef.current = nameInput;
          setPendingFieldTarget("name");
          playAccessibleChime("focus");
          const msg = isGujarati ? "પૂરા નામ પર પાછા આવ્યા. કૃપા કરીને તમારું નામ બોલો." : isHindi ? "पूरे नाम पर वापस आए। कृपया अपना नाम बोलें।" : "Heading back to Full Name. Please speak your name.";
          setAiSpeechPrompt(msg);
          speakText(msg, { lang: currentLangRef.current });
          showStatus(`🎙️ ${msg}`, 3500);
          return;
        }
      }

      if (isJumpEmail) {
        const emailInput = document.querySelector<HTMLInputElement>(
          '#auth-email-input, input[type="email"], input[name*="email" i], input[id*="email" i]'
        );
        if (emailInput) {
          emailInput.focus();
          focusedElementRef.current = emailInput;
          setPendingFieldTarget("email");
          playAccessibleChime("focus");
          const msg = isGujarati ? "ઈમેઇલ સરનામા પર પાછા આવ્યા. કૃપા કરીને તમારું ઈમેઇલ બોલો." : isHindi ? "ईमेल पते पर वापस आए। कृपया अपना ईमेल बोलें।" : "Heading back to Email Address. Please speak your email address.";
          setAiSpeechPrompt(msg);
          speakText(msg, { lang: currentLangRef.current });
          showStatus(`🎙️ ${msg}`, 3500);
          return;
        }
      }

      if (isJumpPin) {
        const pinInput = document.querySelector<HTMLInputElement>(
          '#auth-password-input, input[type="password"], input[name*="pass" i], input[id*="pass" i]'
        );
        if (pinInput) {
          pinInput.focus();
          focusedElementRef.current = pinInput;
          setPendingFieldTarget("password");
          playAccessibleChime("focus");
          const msg = isGujarati ? "પાસવર્ડ/પિન પર પાછા આવ્યા. કૃપા કરીને તમારો પાસવર્ડ બોલો." : isHindi ? "पासवर्ड/पिन पर वापस आए। कृपया अपना पासवर्ड बोलें।" : "Heading back to Password / PIN. Please speak your PIN or password.";
          setAiSpeechPrompt(msg);
          speakText(msg, { lang: currentLangRef.current });
          showStatus(`🎙️ ${msg}`, 3500);
          return;
        }
      }

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

      // ── Command D0: Voice Section Navigation ("go to {section}" / "open {section}" / "go to full section")
      const isNavResume =
        lower.includes("go to resume") ||
        lower.includes("open resume") ||
        lower.includes("resume section") ||
        lower.includes("go to full section") ||
        lower.includes("full section") ||
        lower.includes("resume studio") ||
        lower.includes("રેઝ્યૂમે") ||
        lower.includes("रेज़्यूमे");

      const isNavRoadmap =
        lower.includes("go to roadmap") ||
        lower.includes("open roadmap") ||
        lower.includes("career roadmap") ||
        lower.includes("રોડમેપ") ||
        lower.includes("रोडमैप");

      const isNavCourses =
        lower.includes("go to courses") ||
        lower.includes("open courses") ||
        lower.includes("course section") ||
        lower.includes("કોર્સ") ||
        lower.includes("कोर्स");

      const isNavPractice =
        lower.includes("go to practice") ||
        lower.includes("open practice") ||
        lower.includes("practice hub") ||
        lower.includes("પ્રેક્ટિસ") ||
        lower.includes("प्रैक्टिस");

      const isNavLocal =
        lower.includes("go to jobs") ||
        lower.includes("open jobs") ||
        lower.includes("go to local") ||
        lower.includes("local opportunities") ||
        lower.includes("નોકરી") ||
        lower.includes("नौकरी");

      const isNavAssistant =
        lower.includes("go to assistant") ||
        lower.includes("open assistant") ||
        lower.includes("go to home") ||
        lower.includes("career assistant") ||
        lower.includes("સહાયક") ||
        lower.includes("सहायक");

      if (isNavResume || isNavRoadmap || isNavCourses || isNavPractice || isNavLocal || isNavAssistant) {
        let dest: FeatureId | "assistant" = "assistant";
        let title = "Assistant";
        if (isNavResume) { dest = "resume"; title = "Resume Studio"; }
        else if (isNavRoadmap) { dest = "roadmap"; title = "Career Roadmap"; }
        else if (isNavCourses) { dest = "courses"; title = "Courses"; }
        else if (isNavPractice) { dest = "practice"; title = "Practice Hub"; }
        else if (isNavLocal) { dest = "local"; title = "Local Jobs"; }

        playAccessibleChime("navigate");
        window.dispatchEvent(new CustomEvent("careerforge:navigate", { detail: { feature: dest } }));
        showStatus(`🚀 Navigated to ${title}. Speak now to write or ask questions!`, 4000);

        // After navigation, focus the primary editable input/textarea so subsequent speech is written directly
        setTimeout(() => {
          const primaryInput = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
            'textarea:not([disabled]), input[type="text"]:not([disabled]), input[type="search"]:not([disabled]), input[type="email"]:not([disabled])'
          );
          if (primaryInput) {
            primaryInput.focus();
            focusedElementRef.current = primaryInput;
          }
        }, 350);
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

      // ── Command E: Live Focused Field Filling with Step Auto-Progression ─────
      if (focusedElementRef.current) {
        const target = focusedElementRef.current;
        const isNameField =
          target.name?.toLowerCase().includes("name") ||
          target.id?.toLowerCase().includes("name") ||
          target.placeholder?.toLowerCase().includes("name") ||
          target.getAttribute("aria-label")?.toLowerCase().includes("name");

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

        const isPasswordField =
          target.type === "password" ||
          target.name?.toLowerCase().includes("pass") ||
          target.id?.toLowerCase().includes("pass") ||
          target.name?.toLowerCase().includes("pin") ||
          target.id?.toLowerCase().includes("pin");

        if (isNameField) {
          const cleanName = normalizeSpokenName(clean);
          setNativeInputValue(target, cleanName);
          pendingNameVerificationRef.current = cleanName;
          playAccessibleChime("success");
          showStatus(isGujarati ? `નામ: ${cleanName}` : `Name: ${cleanName}`);

          const verifyMsg = isGujarati
            ? `મેં તમારું નામ "${cleanName}" નોંધ્યું છે. શું આ સાચું છે? આગળ વધવા માટે 'હા' બોલો અથવા ફરીથી નામ બોલો.`
            : isHindi
            ? `मैंने आपका नाम "${cleanName}" दर्ज किया है। क्या यह सही है? आगे बढ़ने के लिए 'हाँ' कहें या दोबारा बोलें।`
            : `I recorded your name as "${cleanName}". Is that correct? Say 'Yes' to continue or speak your name again.`;
          
          setAiSpeechPrompt(verifyMsg);
          speakText(verifyMsg, { lang: currentLangRef.current });
          showStatus(`🎙️ ${verifyMsg}`, 5000);
          return;
        }

        if (isEmailField) {
          const rawEmail = normalizeSpokenEmail(clean);
          setNativeInputValue(target, rawEmail);
          playAccessibleChime("success");
          showStatus(isGujarati ? `ઈમેઇલ: ${rawEmail}` : `Email: ${rawEmail}`);

          // Auto-progress to Password / PIN!
          const nextPass = document.querySelector<HTMLInputElement>(
            '#auth-password-input, input[type="password"], input[name*="pass" i], input[id*="pass" i]'
          );
          if (nextPass) {
            setTimeout(() => {
              nextPass.focus();
              focusedElementRef.current = nextPass;
              setPendingFieldTarget("password");
              const nextMsg = isGujarati
                ? `ઈમેઇલ ${rawEmail} સેવ થયું. સ્ટેપ ૩: કૃપા કરીને તમારો પાસવર્ડ અથવા પિન બોલો.`
                : isHindi
                ? `ईमेल ${rawEmail} सहेज लिया गया। स्टेप ३: कृपया अपना पासवर्ड या पिन बोलें।`
                : `Email recorded as ${rawEmail}. Step 3: Please speak your password or PIN.`;
              setAiSpeechPrompt(nextMsg);
              speakText(nextMsg, { lang: currentLangRef.current });
              showStatus(`🎙️ ${nextMsg}`, 4500);
            }, 500);
          }
          return;
        }

        if (isPasswordField) {
          setNativeInputValue(target, clean);
          playAccessibleChime("success");
          const doneMsg = isGujarati
            ? `પાસવર્ડ ભરાઈ ગયો છે! લૉગિન કરવા માટે 'સબમિટ' બોલો અથવા ફેરફાર કરવા માટે 'નામ બદલવું છે' બોલો.`
            : isHindi
            ? `पासवर्ड दर्ज कर दिया गया है! लॉगिन करने के लिए 'सबमिट' बोलें या बदलाव के लिए 'नाम बदलना है' बोलें।`
            : `Password filled! Say 'Submit' to sign in or say 'Change Name' to edit.`;
          setAiSpeechPrompt(doneMsg);
          speakText(doneMsg, { lang: currentLangRef.current });
          showStatus(`✅ ${doneMsg}`, 5000);
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
      let targetEl: HTMLInputElement | HTMLTextAreaElement | null = focusedElementRef.current;
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
        ? "કરિયરફોર્જમાં સ્વાગત છે! સ્ટેપ ૧: કૃપા કરીને તમારું પૂરું નામ બોલો."
        : isHi
        ? "करियरफोर्ज में स्वागत है! स्टेप १: कृपया अपना पूरा नाम बोलें।"
        : "Welcome to CareerForge! Step 1 of 3: Please speak your full name.";
      
      const nameInput = document.querySelector<HTMLInputElement>(
        '#auth-name-input, input[name*="name" i], input[id*="name" i], input[placeholder*="name" i]'
      );
      if (nameInput) {
        nameInput.focus();
        focusedElementRef.current = nameInput;
      }
      setAiSpeechPrompt(welcome);
      setPendingFieldTarget("name");
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

  // ─── 6. Clean Voice Dictation Lifecycle ────────────────────────────────────
  useEffect(() => {
    return () => {
      controllerRef.current?.stop();
    };
  }, []);

  // ─── 7. Tab-Switch & Minimize Auto-Pause with Direct Question on Return ─────
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab hidden or browser minimized: pause voice detection temporarily
        if (active || listening) {
          wasActiveBeforeBlurRef.current = true;
          controllerRef.current?.stop();
          controllerRef.current = null;
          setListening(false);
          stopSpeaking();
          showStatus("⏸️ Voice paused (tab minimized)", 2500);
        }
      } else {
        // Tab restored/active: resume voice detection & directly ask a question
        if (wasActiveBeforeBlurRef.current || voiceMode) {
          wasActiveBeforeBlurRef.current = false;

          let questionPrompt = "";
          const isGu = currentLangRef.current.startsWith("gu");
          const isHi = currentLangRef.current.startsWith("hi");
          const isFr = currentLangRef.current.startsWith("fr");

          if (focusedElementRef.current) {
            questionPrompt = getFieldPromptMessage(
              focusedFieldLabel || "field",
              focusedElementRef.current.type,
              currentLangRef.current
            );
          } else {
            if (isGu) {
              questionPrompt = "પાછા સ્વાગત છે! હું તમારો અવાજ સાંભળવા તૈયાર છું. તમે શું કરવા માંગો છો?";
            } else if (isHi) {
              questionPrompt = "वापसी पर स्वागत है! मैं आपकी आवाज़ सुनने के लिए तैयार हूँ। आप क्या करना चाहेंगे?";
            } else if (isFr) {
              questionPrompt = "Bon retour ! Je vous écoute. Que souhaitez-vous faire maintenant ?";
            } else {
              questionPrompt = "Welcome back! I am listening. What would you like to explore next?";
            }
          }

          setAiSpeechPrompt(questionPrompt);
          showStatus("🎙️ " + questionPrompt, 4000);
          playAccessibleChime("focus");

          if (accessibilityPrefs?.speechOutput !== false) {
            speakText(questionPrompt, {
              lang: currentLangRef.current,
              onEnd: () => {
                startVoiceDictation();
              },
            });
          } else {
            startVoiceDictation();
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [active, listening, voiceMode, accessibilityPrefs, focusedFieldLabel, startVoiceDictation, showStatus]);

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
            title="Voice Dictation & AI Assistant (Active)"
            aria-pressed={active}
          >
            <span className="text-sm">{active ? "🛑" : "🎙️"}</span>
            <span>{active ? "Listening..." : "Voice Start"}</span>
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
