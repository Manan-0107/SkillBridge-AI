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
  speakLetter,
  SUPPORTED_LANGUAGES,
  setGlobalVoiceLanguage,
  isAIAudioPlaying,
  isSelfVoiceEcho,
  normalizeSpokenEmail,
  normalizeSpokenName,
  normalizeSpokenPassword,
  getFieldPromptMessage,
} from "@/lib/voice";

// ─── Profile Questionnaire & Section Definitions ──────────────────────────────

export type ProfileQuestionId = "name" | "email" | "password" | "targetRole" | "skills";

export interface ProfileQuestion {
  id: ProfileQuestionId;
  label: string;
  stepNumber: number;
  prompts: {
    en: string;
    gu: string;
    hi: string;
  };
  retryPrompts: {
    en: string;
    gu: string;
    hi: string;
  };
  confirmPrompts: {
    en: (ans: string) => string;
    gu: (ans: string) => string;
    hi: (ans: string) => string;
  };
  selector: string;
}

const PROFILE_QUESTIONS: ProfileQuestion[] = [
  {
    id: "name",
    label: "Full Name",
    stepNumber: 1,
    prompts: {
      en: "Welcome to CareerForge! Step 1: What is your full name?",
      gu: "કરિયરફોર્જમાં આપનું સ્વાગત છે! સ્ટેપ ૧: તમારું પૂરું નામ શું છે?",
      hi: "करियरफोर्ज में आपका स्वागत है! स्टेप १: आपका पूरा नाम क्या है?",
    },
    retryPrompts: {
      en: "No problem, let's try again. What is your full name?",
      gu: "કોઈ વાંધો નહીં, ફરીથી પ્રયત્ન કરીએ. તમારું પૂરું નામ શું છે?",
      hi: "कोई बात नहीं, दोबारा कोशिश करते हैं। आपका पूरा नाम क्या है?",
    },
    confirmPrompts: {
      en: (ans) => `Got it, you said: ${ans}. Is that correct? Say Yes to continue, or No to re-speak.`,
      gu: (ans) => `મેં સાંભળ્યું: ${ans}. શું આ સાચું છે? આગળ વધવા 'હા' બોલો, અથવા ફરીથી બોલવા 'ના' બોલો.`,
      hi: (ans) => `मैंने सुना: ${ans}। क्या यह सही है? आगे बढ़ने के लिए 'हाँ' कहें, या दोबारा बोलने के लिए 'नहीं' कहें।`,
    },
    selector: '#auth-name-input, input[name*="name" i], input[id*="name" i]',
  },
  {
    id: "email",
    label: "Contact Email",
    stepNumber: 2,
    prompts: {
      en: "Step 2: What is your contact email address?",
      gu: "સ્ટેપ ૨: તમારું ઇમેઇલ સરનામું શું છે?",
      hi: "स्टेप २: आपका ईमेल पता क्या है?",
    },
    retryPrompts: {
      en: "No problem, let's try again. What is your contact email address?",
      gu: "કોઈ વાંધો નહીં, ફરીથી પ્રયત્ન કરીએ. તમારું ઇમેઇલ સરનામું શું છે?",
      hi: "कोई बात नहीं, दोबारा कोशिश करते हैं। आपका ईमेल पता क्या है?",
    },
    confirmPrompts: {
      en: (ans) => `Got it, your email is: ${ans}. Is that correct? Say Yes to continue, or No to re-speak.`,
      gu: (ans) => `તમારું ઇમેઇલ: ${ans}. શું આ સાચું છે? આગળ વધવા 'હા' બોલો, અથવા ફરીથી બોલવા 'ના' બોલો.`,
      hi: (ans) => `आपका ईमेल: ${ans}। क्या यह सही है? आगे बढ़ने के लिए 'हाँ' कहें, या दोबारा बोलने के लिए 'नहीं' कहें।`,
    },
    selector: '#auth-email-input, input[type="email"], input[name*="email" i], input[id*="email" i]',
  },
  {
    id: "password",
    label: "Password",
    stepNumber: 3,
    prompts: {
      en: "Step 3: Please speak your password or PIN for your account. It must be at least 6 characters.",
      gu: "સ્ટેપ ૩: કૃપા કરીને તમારા એકાઉન્ટ માટે પાસવર્ડ અથવા પિન બોલો. તે ઓછામાં ઓછા ૬ અક્ષરનો હોવો જોઈએ.",
      hi: "स्टेप ३: कृपया अपने खाते के लिए पासवर्ड या पिन बोलें। यह कम से कम ६ अक्षरों का होना चाहिए।",
    },
    retryPrompts: {
      en: "Password must have at least 6 characters. Please speak your password or PIN.",
      gu: "પાસવર્ડ ઓછામાં ઓછો ૬ અક્ષરનો હોવો જોઈએ. કૃપા કરીને તમારો પાસવર્ડ અથવા પિન બોલો.",
      hi: "पासवर्ड कम से कम ६ अक्षरों का होना चाहिए। कृपया अपना पासवर्ड या पिन बोलें।",
    },
    confirmPrompts: {
      en: (ans) => `Got it, password recorded with ${ans.length} characters. Is that correct? Say Yes to continue, or No to re-speak.`,
      gu: (ans) => `પાસવર્ડ નોંધાઈ ગયો (${ans.length} અક્ષરો). શું આ સાચું છે? આગળ વધવા 'હા' બોલો, અથવા ફરીથી બોલવા 'ના' બોલો.`,
      hi: (ans) => `पासवर्ड दर्ज हुआ (${ans.length} अक्षर)। क्या यह सही है? आगे बढ़ने के लिए 'हाँ' कहें, या दोबारा बोलने के लिए 'नहीं' कहें।`,
    },
    selector: '#auth-password-input, input[type="password"], input[name*="pass" i], input[id*="pass" i]',
  },
  {
    id: "targetRole",
    label: "Target Career Role",
    stepNumber: 4,
    prompts: {
      en: "What is your target career or dream job role?",
      gu: "તમારો ઇચ્છિત કરિયર રોલ અથવા જોબ ટાઇટલ શું છે?",
      hi: "आपका लक्षित करियर रोल या पद क्या है?",
    },
    retryPrompts: {
      en: "No problem, let's try again. What is your target career or dream job role?",
      gu: "કોઈ વાંધો નહીં, ફરીથી પ્રયત્ન કરીએ. તમારો ઇચ્છિત કરિયર રોલ શું છે?",
      hi: "कोई बात नहीं, दोबारा कोशिश करते हैं। आपका लक्षित पद क्या है?",
    },
    confirmPrompts: {
      en: (ans) => `Got it, your target role is: ${ans}. Is that correct? Say Yes to continue, or No to re-speak.`,
      gu: (ans) => `તમારો લક્ષિત રોલ: ${ans}. શું આ બરાબર છે? 'હા' અથવા 'ના' બોલો.`,
      hi: (ans) => `आपका लक्षित रोल: ${ans}। क्या यह सही है? 'हाँ' या 'नहीं' बोलें।`,
    },
    selector: 'input[name*="role" i], input[id*="role" i], input[placeholder*="role" i]',
  },
  {
    id: "skills",
    label: "Core Skills",
    stepNumber: 5,
    prompts: {
      en: "What are two or three of your core technical skills or strengths?",
      gu: "તમારી મુખ્ય ટેકનિકલ સ્કિલ્સ અથવા શક્તિઓ કઈ છે?",
      hi: "आपके मुख्य तकनीकी कौशल या खूबियां क्या हैं?",
    },
    retryPrompts: {
      en: "No problem, let's try again. What are two or three of your core skills?",
      gu: "કોઈ વાંધો નહીં, ફરીથી પ્રયત્ન કરીએ. તમારી ટેકનિકલ સ્કિલ્સ કઈ છે?",
      hi: "कोई बात नहीं, दोबारा कोशिश करते हैं। आपके मुख्य कौशल क्या हैं?",
    },
    confirmPrompts: {
      en: (ans) => `Got it, your skills are: ${ans}. Is that correct? Say Yes to continue, or No to re-speak.`,
      gu: (ans) => `તમારી સ્કિલ્સ: ${ans}. શું આ સાચું છે? 'હા' અથવા 'ના' બોલો.`,
      hi: (ans) => `आपके कौशल: ${ans}। क्या यह सही है? 'हाँ' या 'नहीं' बोलें।`,
    },
    selector: 'input[name*="skill" i], input[id*="skill" i], input[placeholder*="skill" i]',
  },
];

const INTERVIEW_STORAGE_KEY = "careerforge_profile_interview_v1";

interface StoredInterviewState {
  name?: string;
  targetRole?: string;
  skills?: string;
  email?: string;
  password?: string;
  completedQuestions: ProfileQuestionId[];
}

function loadStoredInterview(user?: any): StoredInterviewState {
  if (typeof window === "undefined") return { completedQuestions: [] };
  try {
    const raw = localStorage.getItem(INTERVIEW_STORAGE_KEY);
    const parsed: StoredInterviewState = raw ? JSON.parse(raw) : { completedQuestions: [] };

    // If user is already logged in with an active account, auto-mark auth steps as completed
    if (user?.email) {
      if (!parsed.completedQuestions.includes("email")) parsed.completedQuestions.push("email");
      if (user.name && !parsed.completedQuestions.includes("name")) parsed.completedQuestions.push("name");
      if (!parsed.completedQuestions.includes("password")) parsed.completedQuestions.push("password");
      if (user.targetRole && !parsed.completedQuestions.includes("targetRole")) parsed.completedQuestions.push("targetRole");
    }
    return parsed;
  } catch {}
  return { completedQuestions: [] };
}

function saveStoredInterview(state: StoredInterviewState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(INTERVIEW_STORAGE_KEY, JSON.stringify(state));
  } catch {}

  // Also persist asynchronously to server keyed by client IP and device cookie
  try {
    fetch("/api/profile/anonymous", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    }).catch(() => {});
  } catch {}
}

function getNextRemainingQuestion(completedQuestions: ProfileQuestionId[], user?: any): ProfileQuestion | null {
  // Check live DOM form inputs to guarantee strict chronological order:
  // Step 1: Name -> Step 2: Email -> Step 3: Password -> Step 4: Role -> Step 5: Location
  if (typeof document !== "undefined") {
    const nameInput = document.querySelector<HTMLInputElement>('#auth-name-input');
    const emailInput = document.querySelector<HTMLInputElement>('#auth-email-input');
    const passInput = document.querySelector<HTMLInputElement>('#auth-password-input');

    if (!user) {
      // 1. If Name is in the DOM and is empty or not completed, MUST ask Step 1 (Name)
      if (nameInput && (!nameInput.value.trim() || !completedQuestions.includes("name"))) {
        return PROFILE_QUESTIONS[0];
      }
      // 2. If Name is verified/filled, but Email is empty or not completed, MUST ask Step 2 (Email)
      if (emailInput && (!emailInput.value.trim() || !completedQuestions.includes("email"))) {
        return PROFILE_QUESTIONS[1];
      }
      // 3. If Name and Email are filled, but Password is empty or not completed, MUST ask Step 3 (Password)
      if (passInput && (!passInput.value.trim() || !completedQuestions.includes("password"))) {
        return PROFILE_QUESTIONS[2];
      }
    }
  }

  for (const q of PROFILE_QUESTIONS) {
    if (completedQuestions.includes(q.id)) {
      continue;
    }
    // If user is already signed in, skip auth questions
    if (user && (q.id === "name" || q.id === "email" || q.id === "password")) {
      continue;
    }
    return q;
  }
  return null;
}

let globalVoiceDictatorStarted = false;

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
    setUserSkills,
    missingSkills,
    setTargetRole,
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
  const [isAiAnswering, setIsAiAnswering] = useState(false);

  // ─── Questionnaire & Verification State ─────────────────────────────────────
  const [interviewState, setInterviewState] = useState<StoredInterviewState>(() => loadStoredInterview(user));
  const [currentQuestion, setCurrentQuestion] = useState<ProfileQuestion | null>(() =>
    getNextRemainingQuestion(loadStoredInterview(user).completedQuestions, user)
  );
  const [pendingVerification, setPendingVerification] = useState<{
    question: ProfileQuestion;
    candidateAnswer: string;
  } | null>(null);

  const controllerRef = useRef<SpeechRecognitionController | null>(null);
  const focusedElementRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const statusTimerRef = useRef<NodeJS.Timeout | null>(null);
  const wasActiveBeforeBlurRef = useRef(false);
  const currentLangRef = useRef(voiceLanguage);
  currentLangRef.current = voiceLanguage;
  const activeRef = useRef(active);
  activeRef.current = active;
  const currentQuestionRef = useRef(currentQuestion);
  currentQuestionRef.current = currentQuestion;
  const pendingVerificationRef = useRef(pendingVerification);
  pendingVerificationRef.current = pendingVerification;
  const interviewStateRef = useRef(interviewState);
  interviewStateRef.current = interviewState;

  const showStatus = useCallback((msg: string, duration = 3500) => {
    setStatusMessage(msg);
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => {
      setStatusMessage(null);
    }, duration);
  }, []);

  // ─── Hydrate Pre-verified Fields from LocalStorage + Server IP/Device Store ──
  useEffect(() => {
    const local = loadStoredInterview(user);
    setInterviewState(local);
    const nextQ = getNextRemainingQuestion(local.completedQuestions, user);
    setCurrentQuestion(nextQ);

    const applyFields = (data: StoredInterviewState) => {
      if (data.name) {
        const nameInput = document.querySelector<HTMLInputElement>(PROFILE_QUESTIONS[0].selector);
        if (nameInput && !nameInput.value) setNativeInputValue(nameInput, data.name);
      }
      if (data.email) {
        const emailInput = document.querySelector<HTMLInputElement>(PROFILE_QUESTIONS[1].selector);
        if (emailInput && !emailInput.value) setNativeInputValue(emailInput, data.email);
      }
    };

    applyFields(local);

    // Fetch IP and Device-backed persistence from server
    fetch("/api/profile/anonymous")
      .then((res) => res.json())
      .then((data) => {
        if (data?.ok && data.profile) {
          const merged: StoredInterviewState = {
            ...local,
            ...data.profile,
            completedQuestions: Array.from(
              new Set([...local.completedQuestions, ...(data.profile.completedQuestions || [])])
            ),
          };
          setInterviewState(merged);
          interviewStateRef.current = merged;
          saveStoredInterview(merged);
          applyFields(merged);
          const updatedNextQ = getNextRemainingQuestion(merged.completedQuestions, user);
          setCurrentQuestion(updatedNextQ);
          currentQuestionRef.current = updatedNextQ;
        }
      })
      .catch(() => {});
  }, [user]);

  // ─── Track Active Focused Input / Textarea ──────────────────────────────────
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

        // If not verifying, show field hint
        if (!pendingVerificationRef.current) {
          const prompt = getFieldPromptMessage(label, target.type, currentLangRef.current);
          setAiSpeechPrompt(prompt);
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

  // ─── Keyboard Shortcuts: Alt+V (Voice Dictation) & Keystroke Readback ───────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle Voice Dictation (Alt + V or Alt + B)
      if (e.altKey && (e.key === "v" || e.key === "V" || e.key === "b" || e.key === "B")) {
        e.preventDefault();
        toggleVoiceDictation();
        return;
      }
      if (e.key === "Escape" && active) {
        stopVoiceDictation();
        return;
      }

      // Letter-by-letter vocal readback for accessibility typing
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) &&
        !e.altKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        accessibilityPrefs?.speechOutput !== false
      ) {
        if (e.key && e.key.length === 1) {
          speakLetter(e.key, currentLangRef.current);
        } else if (e.key === "Backspace" || e.key === "Enter") {
          speakLetter(e.key, currentLangRef.current);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, accessibilityPrefs?.speechOutput]);

  // ─── Microphone Speech Recognition Starter ──────────────────────────────────
  const startListeningMic = useCallback(() => {
    if (!isSpeechRecognitionSupported()) return;

    controllerRef.current?.stop();
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
  }, []);

  // ─── Speech Synthesis with Acoustic Echo Cancellation & Microphone Loop ─────
  const speakAndListen = useCallback(
    (textToSay: string, lang?: string) => {
      stopSpeaking();
      controllerRef.current?.stop();
      setListening(false);

      const speechLang = lang || currentLangRef.current || "en-US";
      speakText(textToSay, {
        lang: speechLang,
        rate: 0.92,
        onEnd: () => {
          // Acoustic dissipation cooldown (1800ms) guarantees that speaker vibrations
          // and ambient reverberations have cleared before the microphone opens
          setTimeout(() => {
            if (activeRef.current && !isSpeaking()) {
              playAccessibleChime("focus");
              startListeningMic();
            }
          }, 1800);
        },
      });
    },
    [startListeningMic]
  );

  // ─── Ask AI Assistant for Dynamic Guidance (Claude/ChatGPT Caliber) ──────────
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
              name: user?.name || interviewStateRef.current.name,
              email: user?.email || interviewStateRef.current.email,
              targetRole: user?.targetRole || interviewStateRef.current.targetRole || undefined,
              skills: userSkills.length ? userSkills : interviewStateRef.current.skills?.split(",") || [],
              missingSkills,
              location: currentLocation || undefined,
            },
            targetRole: user?.targetRole || interviewStateRef.current.targetRole || "Software Engineer",
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
          showStatus(`🤖 ${replyText.slice(0, 55)}...`, 5000);
          if (accessibilityPrefs?.speechOutput !== false) {
            speakAndListen(replyText, detectedLang);
          }
        }
      } catch (err) {
        console.warn("[VoiceAgent] AI query error:", err);
      } finally {
        setIsAiAnswering(false);
      }
    },
    [user, userSkills, missingSkills, currentLocation, accessibilityPrefs, setAccessibilityPrefs, showStatus, speakAndListen]
  );

  // ─── Find Appropriate Target DOM Element for Live Typing ────────────────────
  const resolveTargetElement = useCallback((): HTMLInputElement | HTMLTextAreaElement | null => {
    // 1. If user explicitly focused an element
    if (focusedElementRef.current && document.body.contains(focusedElementRef.current)) {
      return focusedElementRef.current;
    }

    // 2. If active questionnaire question has a dedicated selector
    const currentQ = currentQuestionRef.current;
    if (currentQ) {
      const match = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(currentQ.selector);
      if (match) return match;
    }

    // 3. If currently on active element that is an input/textarea
    const activeEl = document.activeElement;
    if (activeEl instanceof HTMLInputElement || activeEl instanceof HTMLTextAreaElement) {
      return activeEl;
    }

    // 4. Look for common inputs sequentially (name -> email -> password -> assistant textarea)
    const nameInput = document.querySelector<HTMLInputElement>('#auth-name-input');
    if (nameInput && !nameInput.value.trim()) return nameInput;

    const emailInput = document.querySelector<HTMLInputElement>('#auth-email-input');
    if (emailInput && !emailInput.value.trim()) return emailInput;

    const passInput = document.querySelector<HTMLInputElement>('#auth-password-input');
    if (passInput && !passInput.value.trim()) return passInput;

    // 5. Look for assistant composer textarea or any visible text input
    return document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      'textarea:not([disabled]), input[type="text"]:not([disabled]), input[type="search"]:not([disabled])'
    );
  }, []);

  // ─── Voice Command & Spoken Text Processor with Live Typing ─────────────────
  const processSpokenText = useCallback(
    (text: string, isFinal: boolean) => {
      // Barge-in: immediately stop AI speech if user interrupts
      if (isSpeaking()) {
        stopSpeaking();
      }

      const clean = text.trim();
      if (!clean) return;

      // Detect spoken language
      const detectedLang = detectTextLanguage(clean);
      if (detectedLang && detectedLang !== currentLangRef.current) {
        setVoiceLanguage(detectedLang);
        setGlobalVoiceLanguage(detectedLang);
        currentLangRef.current = detectedLang;
      }

      const isGujarati = detectedLang === "gu-IN" || /[\u0A80-\u0AFF]/.test(clean);
      const isHindi = detectedLang === "hi-IN" || /[\u0900-\u097F]/.test(clean);
      const lower = clean.toLowerCase();

      // Guard: Discard if tab is backgrounded
      if (typeof document !== "undefined" && document.hidden) {
        return;
      }

      // ── CRITICAL ANTI-RECURSION FILTER ──
      // Drop any audio recognized during or within acoustic cooldown of AI speech
      if (isSpeaking() || isAIAudioPlaying() || isSelfVoiceEcho(clean)) {
        return;
      }

      // Drop any recognized transcript that matches any part of AI assistant question prompts
      const isQuestionEcho =
        lower.includes("what is your") ||
        lower.includes("what is") ||
        lower.includes("full name") ||
        lower.includes("your full name") ||
        lower.includes("your name") ||
        lower.includes("step 1") ||
        lower.includes("step 2") ||
        lower.includes("step 3") ||
        lower.includes("step 4") ||
        lower.includes("step 5") ||
        lower.includes("contact email") ||
        lower.includes("email address") ||
        lower.includes("password or pin") ||
        lower.includes("target career") ||
        lower.includes("dream job") ||
        lower.includes("core technical skills") ||
        lower.includes("core skills") ||
        lower.includes("say yes to continue") ||
        lower.includes("say yes") ||
        lower.includes("say no") ||
        lower.includes("to re-speak") ||
        lower.includes("is that correct") ||
        lower.includes("welcome to careerforge") ||
        lower.includes("let's try again") ||
        lower.includes("no problem") ||
        lower.includes("got it you said") ||
        lower.includes("got it your email") ||
        lower.includes("પૂરું નામ") ||
        lower.includes("તમારું નામ") ||
        lower.includes("તમારું ઇમેઇલ") ||
        lower.includes("સાચું છે") ||
        lower.includes("સ્વાગત છે") ||
        lower.includes("કરિયરફોર્જ") ||
        lower.includes("पूरा नाम") ||
        lower.includes("आपका नाम") ||
        lower.includes("आपका ईमेल") ||
        lower.includes("सही है") ||
        lower.includes("स्वागत है") ||
        lower.includes("करियरफोर्ज");

      if (isQuestionEcho) {
        return;
      }

      // ── SPECIAL INTENT A: USER EXPLICITLY STATES EMAIL ("my email is mananshah1127@gmail.com") ──
      const isExplicitEmail =
        lower.includes("@") ||
        lower.includes("gmail") ||
        lower.includes("yahoo") ||
        lower.includes("outlook") ||
        lower.includes("at the rate") ||
        lower.startsWith("my email is") ||
        lower.startsWith("email is") ||
        lower.startsWith("મારું ઈમેલ") ||
        lower.startsWith("मेरा ईमेल");

      if (isExplicitEmail && !pendingVerificationRef.current) {
        const extractedEmail = normalizeSpokenEmail(clean);
        if (extractedEmail && extractedEmail.includes("@")) {
          // Switch active section in AuthGate
          window.dispatchEvent(
            new CustomEvent("careerforge:auth-section", { detail: { section: "email" } })
          );
          const emailInput = document.querySelector<HTMLInputElement>(PROFILE_QUESTIONS[1].selector);
          if (emailInput) {
            emailInput.scrollIntoView({ behavior: "smooth", block: "center" });
            emailInput.focus();
            focusedElementRef.current = emailInput;
            setNativeInputValue(emailInput, extractedEmail);
            window.dispatchEvent(
              new CustomEvent("careerforge:auth-value", { detail: { field: "email", value: extractedEmail } })
            );
          }

          if (isFinal) {
            setLiveTranscript(extractedEmail);
            const emailQ = PROFILE_QUESTIONS[1];
            setPendingVerification({
              question: emailQ,
              candidateAnswer: extractedEmail,
            });
            pendingVerificationRef.current = {
              question: emailQ,
              candidateAnswer: extractedEmail,
            };

            const confirmMsg = isGujarati
              ? emailQ.confirmPrompts.gu(extractedEmail)
              : isHindi
              ? emailQ.confirmPrompts.hi(extractedEmail)
              : emailQ.confirmPrompts.en(extractedEmail);

            setAiSpeechPrompt(confirmMsg);
            showStatus(`📧 ${extractedEmail} — ${confirmMsg}`, 5000);
            speakAndListen(confirmMsg);
            return;
          }
          return;
        }
      }

      // ── SPECIAL INTENT B: USER EXPLICITLY STATES NAME ("my name is ...") ──
      const isExplicitName =
        lower.startsWith("my name is") ||
        lower.startsWith("name is") ||
        lower.startsWith("મારું નામ") ||
        lower.startsWith("मेरा नाम");

      if (isExplicitName && !pendingVerificationRef.current) {
        const extractedName = normalizeSpokenName(clean);
        if (extractedName) {
          window.dispatchEvent(
            new CustomEvent("careerforge:auth-section", { detail: { section: "name" } })
          );
          const nameInput = document.querySelector<HTMLInputElement>(PROFILE_QUESTIONS[0].selector);
          if (nameInput) {
            nameInput.scrollIntoView({ behavior: "smooth", block: "center" });
            nameInput.focus();
            focusedElementRef.current = nameInput;
            setNativeInputValue(nameInput, extractedName);
            window.dispatchEvent(
              new CustomEvent("careerforge:auth-value", { detail: { field: "name", value: extractedName } })
            );
          }

          if (isFinal) {
            setLiveTranscript(extractedName);
            const nameQ = PROFILE_QUESTIONS[0];
            setPendingVerification({
              question: nameQ,
              candidateAnswer: extractedName,
            });
            pendingVerificationRef.current = {
              question: nameQ,
              candidateAnswer: extractedName,
            };

            const confirmMsg = isGujarati
              ? nameQ.confirmPrompts.gu(extractedName)
              : isHindi
              ? nameQ.confirmPrompts.hi(extractedName)
              : nameQ.confirmPrompts.en(extractedName);

            setAiSpeechPrompt(confirmMsg);
            showStatus(`👤 ${extractedName} — ${confirmMsg}`, 5000);
            speakAndListen(confirmMsg);
            return;
          }
          return;
        }
      }

      // ── 1. LIVE TYPING (Interim & Final) ──────────────────────────────────
      if (!pendingVerificationRef.current) {
        const targetEl = resolveTargetElement();
        if (targetEl) {
          focusedElementRef.current = targetEl;
          let valueToType = clean;
          if (targetEl.type === "email" || targetEl.id === "auth-email-input") {
            valueToType = normalizeSpokenEmail(clean);
          } else if (targetEl.type === "password" || targetEl.id === "auth-password-input") {
            valueToType = normalizeSpokenPassword(clean);
          } else if (targetEl.id === "auth-name-input") {
            valueToType = normalizeSpokenName(clean);
          }
          setNativeInputValue(targetEl, valueToType);
        }
      }

      if (!isFinal) {
        setInterimTranscript(clean);
        return;
      }

      setInterimTranscript("");
      setLiveTranscript(clean);

      // ── 2. HANDLE QUESTION VERIFICATION ("Yes" / "No") ────────────────────
      const pending = pendingVerificationRef.current;
      if (pending) {
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
          playAccessibleChime("success");
          const verifiedAnswer = pending.candidateAnswer;
          const verifiedQuestion = pending.question;

          // ── ERASE PREVIOUS WRITTEN THING IN VOICE ASSISTANT MEMORY ──
          setPendingVerification(null);
          pendingVerificationRef.current = null;
          setLiveTranscript("");
          setInterimTranscript("");

          // Update interview state and persist to localStorage + server
          const prevStored = interviewStateRef.current;
          const newCompleted = Array.from(new Set([...prevStored.completedQuestions, verifiedQuestion.id]));
          const updatedState: StoredInterviewState = {
            ...prevStored,
            [verifiedQuestion.id]: verifiedAnswer,
            completedQuestions: newCompleted,
          };
          setInterviewState(updatedState);
          interviewStateRef.current = updatedState;
          saveStoredInterview(updatedState);

          // Update app-level stores & form inputs
          if (verifiedQuestion.id === "name" && verifiedAnswer) {
            const el = document.querySelector<HTMLInputElement>(verifiedQuestion.selector);
            if (el) setNativeInputValue(el, verifiedAnswer);
            window.dispatchEvent(
              new CustomEvent("careerforge:auth-value", { detail: { field: "name", value: verifiedAnswer } })
            );
          } else if (verifiedQuestion.id === "email" && verifiedAnswer) {
            const el = document.querySelector<HTMLInputElement>(verifiedQuestion.selector);
            if (el) setNativeInputValue(el, verifiedAnswer);
            window.dispatchEvent(
              new CustomEvent("careerforge:auth-value", { detail: { field: "email", value: verifiedAnswer } })
            );
            // Persist carefully to /api/user for database record and fetching
            try {
              fetch("/api/user", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  user: {
                    email: verifiedAnswer,
                    name: updatedState.name || "Candidate",
                    authProvider: "email",
                  },
                  state: {
                    interview: updatedState,
                  },
                }),
              }).catch(() => {});
            } catch {}
          } else if (verifiedQuestion.id === "password" && verifiedAnswer) {
            const el = document.querySelector<HTMLInputElement>(verifiedQuestion.selector);
            if (el) setNativeInputValue(el, verifiedAnswer);
            window.dispatchEvent(
              new CustomEvent("careerforge:auth-value", { detail: { field: "password", value: verifiedAnswer } })
            );
          } else if (verifiedQuestion.id === "targetRole" && verifiedAnswer) {
            try {
              setTargetRole(verifiedAnswer as any);
            } catch {}
          } else if (verifiedQuestion.id === "skills" && verifiedAnswer) {
            const parsedSkills = verifiedAnswer.split(/[,&]+/).map((s) => s.trim()).filter(Boolean);
            setUserSkills(parsedSkills);
          }

          // ── GO TO NEXT SECTION & STORE NEW THING ──
          const nextQ = getNextRemainingQuestion(newCompleted, user);
          setCurrentQuestion(nextQ);
          currentQuestionRef.current = nextQ;

          if (nextQ) {
            // Signal AuthGate to visually activate and navigate to the next section
            if (nextQ.id === "name" || nextQ.id === "email" || nextQ.id === "password") {
              window.dispatchEvent(
                new CustomEvent("careerforge:auth-section", { detail: { section: nextQ.id } })
              );
            }

            // Focus and scroll next input element into view
            const nextEl = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(nextQ.selector);
            if (nextEl) {
              nextEl.scrollIntoView({ behavior: "smooth", block: "center" });
              nextEl.focus();
              focusedElementRef.current = nextEl;
              if (!newCompleted.includes(nextQ.id)) {
                setNativeInputValue(nextEl, "");
              }
            }

            const promptText = isGujarati
              ? `${verifiedQuestion.label} કન્ફર્મ થયું! આગળનો વિભાગ: ${nextQ.prompts.gu}`
              : isHindi
              ? `${verifiedQuestion.label} की पुष्टि हुई! अगला सेक्शन: ${nextQ.prompts.hi}`
              : `${verifiedQuestion.label} confirmed! Next section: ${nextQ.prompts.en}`;

            setAiSpeechPrompt(promptText);
            showStatus(`🎙️ Step ${nextQ.stepNumber} of 5: ${nextQ.label}`, 4500);
            speakAndListen(promptText);
          } else {
            // If on auth gate and just finished password, auto-submit login/signup
            if (verifiedQuestion.id === "password") {
              const submitBtn = document.querySelector<HTMLButtonElement>(
                'button[type="submit"], input[type="submit"], button#submit-btn'
              );
              if (submitBtn) {
                submitBtn.click();
              }
            }

            const allDoneMsg = isGujarati
              ? "અભિનંદન! તમારા બધા પ્રશ્નો વેરિફાય થઈ ગયા છે. તમારું એકાઉન્ટ અને પ્રોફાઇલ તૈયાર છે!"
              : isHindi
              ? "बधाई हो! आपके सभी सवाल सत्यापित हो गए हैं। आपकी प्रोफ़ाइल तैयार है!"
              : "Awesome! All sections are verified. Your CareerForge profile is ready!";

            setAiSpeechPrompt(allDoneMsg);
            showStatus(`🎉 ${allDoneMsg}`, 5000);
            speakAndListen(allDoneMsg);
          }
          return;
        }

        if (isNo) {
          playAccessibleChime("stop");
          const targetQ = pending.question;

          // ── ERASE PREVIOUS WRITTEN THING FROM MEMORY ──
          setPendingVerification(null);
          pendingVerificationRef.current = null;
          setLiveTranscript("");
          setInterimTranscript("");

          // ── ERASE WRITTEN INPUT IN FIELD ──
          const targetEl =
            document.querySelector<HTMLInputElement | HTMLTextAreaElement>(targetQ.selector) ||
            focusedElementRef.current;
          if (targetEl) {
            setNativeInputValue(targetEl, "");
            targetEl.focus();
            focusedElementRef.current = targetEl;
          }

          // ── AGAIN ASK THE SAME QUESTION ──
          const retryMsg = isGujarati
            ? targetQ.retryPrompts.gu
            : isHindi
            ? targetQ.retryPrompts.hi
            : targetQ.retryPrompts.en;

          setAiSpeechPrompt(retryMsg);
          showStatus(`🎙️ Retrying: ${targetQ.label}`, 4000);
          speakAndListen(retryMsg);
          return;
        }

        // In verification mode, do not process anything else until user clearly says Yes or No
        return;
      }

      // ── 3. GENERAL SYSTEM COMMANDS (Navigation / Submit / Clear / Help) ───

      if (
        lower === "clear" ||
        lower === "erase" ||
        lower === "delete text" ||
        lower === "સાફ કરો" ||
        lower === "हटाओ" ||
        lower === "साफ़ करो"
      ) {
        const target = resolveTargetElement();
        if (target) {
          setNativeInputValue(target, "");
          playAccessibleChime("clear");
          showStatus(isGujarati ? "ખાનું સાફ કર્યું" : isHindi ? "साफ़ किया गया" : "Field cleared");
        }
        return;
      }

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
        const submitBtn = document.querySelector<HTMLButtonElement>(
          'button[type="submit"], input[type="submit"], button#submit-btn'
        );
        if (submitBtn) {
          submitBtn.click();
          showStatus(isGujarati ? "સબમિટ કર્યું" : "Submitted");
        }
        return;
      }

      if (lower === "help" || lower === "help me" || lower.includes("મદદ") || lower.includes("सहायता")) {
        const helpPrompt = isGujarati
          ? "નમસ્તે! હું કરિયરફોર્જ સહાયક છું. તમારું નામ, ઈમેઇલ, જોબ રોલ બોલો અથવા કરિયર પ્રશ્ન પૂછો."
          : isHindi
          ? "नमस्ते! मैं करियरफोर्ज सहायक हूँ। अपना नाम, ईमेल, जॉब रोल बोलें या करियर सवाल पूछें।"
          : "Hello! I am CareerForge Assistant. Speak to answer profile questions, fill forms, or ask career advice.";
        setAiSpeechPrompt(helpPrompt);
        showStatus(helpPrompt, 6000);
        speakAndListen(helpPrompt);
        return;
      }

      // Navigation commands
      const isNavResume = lower.includes("go to resume") || lower.includes("resume studio") || lower.includes("રેઝ્યૂમે");
      const isNavRoadmap = lower.includes("go to roadmap") || lower.includes("career roadmap") || lower.includes("રોડમેપ");
      const isNavCourses = lower.includes("go to courses") || lower.includes("course section") || lower.includes("કોર્સ");
      const isNavPractice = lower.includes("go to practice") || lower.includes("practice hub") || lower.includes("પ્રેક્ટિસ");
      const isNavLocal = lower.includes("go to jobs") || lower.includes("local opportunities") || lower.includes("નોકરી");
      const isNavAssistant = lower.includes("go to assistant") || lower.includes("career assistant") || lower.includes("સહાયક");

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
        return;
      }

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

      // ── 4. QUESTIONNAIRE ANSWER PROCESSING & VERIFICATION PROMPT ─────────
      const activeQ = currentQuestionRef.current;
      if (activeQ) {
        if (clean.length < 2) return;

        let candidateAnswer = clean;
        if (activeQ.id === "name") {
          candidateAnswer = normalizeSpokenName(clean);
          if (!candidateAnswer || candidateAnswer.length < 2) return;
        } else if (activeQ.id === "email") {
          candidateAnswer = normalizeSpokenEmail(clean);
          if (
            !candidateAnswer ||
            (!candidateAnswer.includes("@") &&
              !candidateAnswer.includes("gmail") &&
              !candidateAnswer.includes("yahoo") &&
              !candidateAnswer.includes(".com") &&
              !candidateAnswer.includes(".in"))
          ) {
            return;
          }
        } else if (activeQ.id === "password") {
          candidateAnswer = normalizeSpokenPassword(clean);
          if (!candidateAnswer) return;

          // ── CONSTRAINT CHECK: Password must be at least 6 characters ──
          if (candidateAnswer.length < 6) {
            const targetEl = resolveTargetElement();
            if (targetEl) {
              setNativeInputValue(targetEl, candidateAnswer);
            }
            const shortMsg = isGujarati
              ? `પાસવર્ડ ઓછામાં ઓછો ૬ અક્ષરનો હોવો જોઈએ. તમે માત્ર ${candidateAnswer.length} અક્ષર બોલ્યા છો (${candidateAnswer}). કૃપા કરીને ૬ કે તેથી વધુ અક્ષરનો પાસવર્ડ અથવા પિન બોલો.`
              : isHindi
              ? `पासवर्ड कम से कम ६ अक्षरों का होना चाहिए। आपने केवल ${candidateAnswer.length} अक्षर बोले हैं (${candidateAnswer})। कृपया ६ या अधिक अक्षरों का पासवर्ड या पिन बोलें।`
              : `Password must be at least 6 characters. You spoke ${candidateAnswer.length} characters: ${candidateAnswer}. Please speak a password or PIN with at least 6 characters.`;

            setAiSpeechPrompt(shortMsg);
            showStatus(`⚠️ Password needs 6+ characters (heard: "${candidateAnswer}")`, 6000);
            speakAndListen(shortMsg);
            return;
          }
        }

        const targetEl = resolveTargetElement();
        if (targetEl) {
          setNativeInputValue(targetEl, candidateAnswer);
        }

        setPendingVerification({
          question: activeQ,
          candidateAnswer,
        });
        pendingVerificationRef.current = {
          question: activeQ,
          candidateAnswer,
        };

        const confirmMsg = isGujarati
          ? activeQ.confirmPrompts.gu(candidateAnswer)
          : isHindi
          ? activeQ.confirmPrompts.hi(candidateAnswer)
          : activeQ.confirmPrompts.en(candidateAnswer);

        setAiSpeechPrompt(confirmMsg);
        showStatus(`❓ "${candidateAnswer}" — ${confirmMsg}`, 5000);
        speakAndListen(confirmMsg);
        return;
      }

      // ── 5. GENERAL FIELD TYPING (When Questionnaire is Finished) ─────────
      const targetEl = resolveTargetElement();
      if (targetEl) {
        setNativeInputValue(targetEl, clean);
        playAccessibleChime("success");
        showStatus(`Entered: ${clean.slice(0, 30)}`);
        return;
      }

      // ── 6. CONVERSATIONAL QUESTION TO AI (If not typing into input) ───────
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
        lower.includes("कैसे") ||
        lower.includes("क्या");

      if (isQuestion) {
        // If AssistantHome is actively rendered and composer is visible, delegate to AssistantHome
        const hasAssistantHome =
          typeof document !== "undefined" &&
          Boolean(
            document.querySelector(
              '#assistant-composer, textarea[placeholder*="Ask CareerForge"], textarea[placeholder*="Type or speak"]'
            )
          );
        if (hasAssistantHome && user) {
          return;
        }
        askAiAssistant(clean, detectedLang);
      }
    },
    [askAiAssistant, resolveTargetElement, setTargetRole, setUserSkills, setVoiceLanguage, showStatus, speakAndListen, user]
  );

  // ─── Start & Stop Voice Assistant ───────────────────────────────────────────
  const startVoiceDictation = useCallback(() => {
    if (!isSpeechRecognitionSupported()) {
      showStatus("Speech recognition is not supported in this browser. Please use Chrome/Edge.", 5000);
      return;
    }

    // Stop any speech or recognition immediately before starting a fresh session
    stopSpeaking();
    controllerRef.current?.stop();
    controllerRef.current = null;
    setListening(false);

    playAccessibleChime("start");
    setActive(true);
    activeRef.current = true;
    setVoiceMode(true);

    const stored = loadStoredInterview(user);
    const nextQ = getNextRemainingQuestion(stored.completedQuestions, user);

    if (nextQ) {
      setCurrentQuestion(nextQ);
      currentQuestionRef.current = nextQ;

      if (nextQ.id === "name" || nextQ.id === "email" || nextQ.id === "password") {
        window.dispatchEvent(
          new CustomEvent("careerforge:auth-section", { detail: { section: nextQ.id } })
        );
      }

      setTimeout(() => {
        const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(nextQ.selector);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.focus();
          focusedElementRef.current = el;
        }
      }, 300);

      const isGu = currentLangRef.current === "gu-IN";
      const isHi = currentLangRef.current === "hi-IN";
      const promptText = isGu ? nextQ.prompts.gu : isHi ? nextQ.prompts.hi : nextQ.prompts.en;

      setAiSpeechPrompt(promptText);
      showStatus(`🎙️ Step ${nextQ.stepNumber} of 5: ${nextQ.label}`, 4000);
      speakAndListen(promptText);
    } else {
      const isGu = currentLangRef.current === "gu-IN";
      const isHi = currentLangRef.current === "hi-IN";
      const welcomeBack = isGu
        ? "સ્વાગત છે! તમારી પ્રોફાઇલ કન્ફર્મ થયેલી છે. બોલો, હું મદદ કરવા તૈયાર છું."
        : isHi
        ? "स्वागत है! आपकी प्रोफ़ाइल सत्यापित है। बोलिए, मैं सहायता के लिए तैयार हूँ।"
        : "Welcome back! Your profile is verified. I am listening—speak to type, navigate, or ask any question.";

      setAiSpeechPrompt(welcomeBack);
      showStatus("🎙️ Voice Assistant Active", 3500);
      speakAndListen(welcomeBack);
    }
  }, [setVoiceMode, showStatus, speakAndListen, user]);

  const stopVoiceDictation = useCallback(() => {
    playAccessibleChime("stop");
    controllerRef.current?.stop();
    controllerRef.current = null;
    setActive(false);
    activeRef.current = false;
    setListening(false);
    setLiveTranscript("");
    setInterimTranscript("");
    setAiSpeechPrompt(null);
    setPendingVerification(null);
    pendingVerificationRef.current = null;
    stopSpeaking();
    showStatus("Voice assistant paused", 2000);
  }, [showStatus]);

  const toggleVoiceDictation = () => {
    if (active) {
      stopVoiceDictation();
    } else {
      startVoiceDictation();
    }
  };

  // ─── Auto-Start Voice Assistant Immediately on Entering Website (Strictly Once) ──
  const autoStartedRef = useRef(false);

  useEffect(() => {
    if (globalVoiceDictatorStarted || autoStartedRef.current) return;
    globalVoiceDictatorStarted = true;
    autoStartedRef.current = true;

    const autoTimer = setTimeout(() => {
      startVoiceDictation();
    }, 1200);

    return () => {
      clearTimeout(autoTimer);
    };
  }, [startVoiceDictation]);

  // ─── Tab-Switch Auto-Pause with Guided Reconnect on Return ──────────────────
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (activeRef.current || listening) {
          wasActiveBeforeBlurRef.current = true;
          controllerRef.current?.stop();
          controllerRef.current = null;
          setListening(false);
          stopSpeaking();
          showStatus("⏸️ Voice paused (tab minimized)", 2500);
        }
      } else {
        if (wasActiveBeforeBlurRef.current) {
          wasActiveBeforeBlurRef.current = false;
          const stored = loadStoredInterview(user);
          const nextQ = getNextRemainingQuestion(stored.completedQuestions, user);
          if (nextQ) {
            const isGu = currentLangRef.current.startsWith("gu");
            const isHi = currentLangRef.current.startsWith("hi");
            const questionPrompt = isGu
              ? `પાછા સ્વાગત છે! આગળનો પ્રશ્ન: ${nextQ.prompts.gu}`
              : isHi
              ? `वापसी पर स्वागत है! अगला सवाल: ${nextQ.prompts.hi}`
              : `Welcome back! Continuing setup: ${nextQ.prompts.en}`;
            setAiSpeechPrompt(questionPrompt);
            speakAndListen(questionPrompt);
          } else {
            startListeningMic();
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [listening, showStatus, speakAndListen, startListeningMic, user]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      controllerRef.current?.stop();
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    };
  }, []);

  const currentLangObj =
    SUPPORTED_LANGUAGES.find((l) => l.code === voiceLanguage) || SUPPORTED_LANGUAGES[0];

  const totalSteps = PROFILE_QUESTIONS.length;
  const completedCount = interviewState.completedQuestions.length;

  return (
    <>
      {/* Invisible Screen Reader Announcement Region */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {statusMessage || (active ? "Voice assistant is active" : "Voice assistant is off")}
      </div>

      {/* Floating Accessibility Voice HUD Pill */}
      <aside
        role="region"
        aria-label="Universal Voice Assistant and Accessibility Controls"
        className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2 pointer-events-auto select-none"
      >
        {/* Live Transcript / AI Prompt Popover */}
        {(active || liveTranscript || interimTranscript || aiSpeechPrompt) && voiceBannerOpen && (
          <div className="mb-2 max-w-sm rounded-2xl border border-neutral-200 bg-white/95 p-4 shadow-2xl backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between gap-2 border-b border-neutral-100 pb-2 mb-2">
              <div className="flex items-center gap-2">
                <span className={`flex h-2.5 w-2.5 rounded-full ${listening ? "bg-emerald-500 animate-ping" : "bg-amber-400"}`} />
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                  {isAiAnswering ? "AI Thinking..." : listening ? "Listening (Speak Now)..." : "AI Speaking (Mic Paused)"}
                </span>
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-700 border border-neutral-200">
                  {currentLangObj.flag} {currentLangObj.nativeName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setVoiceBannerOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 text-xs px-1 cursor-pointer"
                aria-label="Minimize Voice HUD"
              >
                ✕
              </button>
            </div>

            {/* Profile Questionnaire Progress Indicator */}
            {completedCount < totalSteps && (
              <div className="mb-2.5 flex items-center justify-between gap-2 rounded-lg bg-emerald-50/80 px-2.5 py-1 text-[11px] font-medium text-emerald-900 border border-emerald-200/80">
                <span>📋 Form Setup Progress:</span>
                <span className="font-bold text-emerald-800">
                  {completedCount} / {totalSteps} verified
                </span>
              </div>
            )}

            {/* AI Assistant Spoken Prompt */}
            {aiSpeechPrompt && (
              <div className="mb-2 rounded-xl bg-neutral-900 p-2.5 text-xs text-white shadow-xs">
                <div className="flex items-center gap-1.5 font-semibold text-[11px] text-emerald-400 mb-1">
                  <span>🤖 CareerForge Voice Assistant:</span>
                </div>
                <p className="leading-relaxed">{aiSpeechPrompt}</p>
              </div>
            )}

            {/* Live Spoken Transcript */}
            <div className="text-xs text-neutral-800 font-medium leading-relaxed min-h-[20px]">
              {liveTranscript && <p className="text-neutral-900 font-semibold">{liveTranscript}</p>}
              {interimTranscript && (
                <p className="text-emerald-700 font-medium italic animate-pulse">Typing: {interimTranscript} ...</p>
              )}
              {!liveTranscript && !interimTranscript && !aiSpeechPrompt && (
                <p className="text-neutral-400 italic">Speak in any language to type into fields or ask questions...</p>
              )}
            </div>

            {/* Focused Target Field Indicator */}
            {focusedFieldLabel && (
              <div className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-neutral-50 px-2.5 py-1 text-[11px] font-medium text-neutral-600 border border-neutral-200/60">
                <span>🎯 Active Section:</span>
                <span className="font-semibold text-neutral-900 truncate max-w-[180px]">
                  {focusedFieldLabel}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Floating Action Bar */}
        <div className="flex items-center gap-2 rounded-full border border-neutral-300 bg-white/95 px-3.5 py-2 shadow-xl backdrop-blur-md">
          {/* Main Voice Assistant Button */}
          <button
            type="button"
            onClick={toggleVoiceDictation}
            className={`group flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-200 cursor-pointer ${
              active
                ? "bg-rose-600 text-white shadow-md hover:bg-rose-700 animate-pulse"
                : "bg-neutral-900 text-white shadow-sm hover:bg-neutral-800"
            }`}
            title="Voice Assistant & Live Dictation (Alt + V)"
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
              const isHi = voiceLanguage === "hi-IN";
              const msg = isGu
                ? "હું તમારી શું મદદ કરી શકું? તમારો પ્રશ્ન પૂછો અથવા ફોર્મ ભરવા માટે બોલો."
                : isHi
                ? "मैं आपकी क्या मदद कर सकता हूँ? अपना सवाल पूछें या फॉर्म भरने के लिए बोलें।"
                : "How can I help you? Ask any question or speak to fill forms.";
              setAiSpeechPrompt(msg);
              speakAndListen(msg, voiceLanguage);
            }}
            className="flex items-center gap-1 rounded-full bg-neutral-100 hover:bg-neutral-200 px-2.5 py-1.5 text-xs font-semibold text-neutral-800 border border-neutral-200 cursor-pointer transition-colors"
            title="Ask AI Assistant for Help"
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
                        startListeningMic();
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
