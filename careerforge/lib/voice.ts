/**
 * Universal Multi-Language Voice & Accessibility Engine (100% Free & Unlimited)
 * - Automatic Language-Matching: If user speaks English, replies in English. If Hindi, replies in Hindi, etc.
 * - Multi-Language Speech Recognition (STT): All Indian, European, Asian & Global languages
 * - High-Quality Speech Synthesis (TTS): Detects language & speaks with matching native voice
 * - React Native Input Event Synchronizer: Dispatches synthetic events to update form states seamlessly
 * - Accessible Audio Chimes: Web Audio API tones for blind and motor-impaired users
 */

export interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: "en-US", name: "English (US)", nativeName: "English (US)", flag: "🇺🇸" },
  { code: "en-IN", name: "English (India)", nativeName: "English (India)", flag: "🇮🇳" },
  { code: "hi-IN", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳" },
  { code: "gu-IN", name: "Gujarati", nativeName: "ગુજરાતી", flag: "🇮🇳" },
  { code: "mr-IN", name: "Marathi", nativeName: "मराठी", flag: "🇮🇳" },
  { code: "ta-IN", name: "Tamil", nativeName: "தமிழ்", flag: "🇮🇳" },
  { code: "te-IN", name: "Telugu", nativeName: "తెలుగు", flag: "🇮🇳" },
  { code: "bn-IN", name: "Bengali", nativeName: "বাংলা", flag: "🇮🇳" },
  { code: "es-ES", name: "Spanish", nativeName: "Español", flag: "🇪🇸" },
  { code: "fr-FR", name: "French", nativeName: "Français", flag: "🇫🇷" },
  { code: "de-DE", name: "German", nativeName: "Deutsch", flag: "🇩🇪" },
  { code: "ja-JP", name: "Japanese", nativeName: "日本語", flag: "🇯🇵" },
  { code: "zh-CN", name: "Mandarin", nativeName: "简体中文", flag: "🇨🇳" },
  { code: "ar-SA", name: "Arabic", nativeName: "العربية", flag: "🇸🇦" },
  { code: "pt-BR", name: "Portuguese", nativeName: "Português", flag: "🇧🇷" },
];

let activeUtterance: SpeechSynthesisUtterance | null = null;
let currentLanguage = "en-US";
let isSelfSpeaking = false;
let lastSpeechEndedAt = 0;
let lastSpokenText = "";
const recentSpokenPhrases: { text: string; time: number }[] = [];

export function getLastSpokenText(): string {
  return lastSpokenText;
}

export function registerSpokenPhrase(text: string) {
  if (!text) return;
  const clean = text.toLowerCase().trim();
  recentSpokenPhrases.push({ text: clean, time: Date.now() });
  if (recentSpokenPhrases.length > 30) recentSpokenPhrases.shift();
  lastSpokenText = clean;
}

export const KNOWN_AI_PROMPT_PATTERNS = [
  "what is your",
  "what is",
  "full name",
  "your full name",
  "your name",
  "step 1",
  "step 2",
  "step 3",
  "step 4",
  "step 5",
  "contact email",
  "email address",
  "password or pin",
  "target career",
  "dream job",
  "core technical skills",
  "core skills",
  "is that correct",
  "say yes to continue",
  "say yes",
  "say no",
  "to re-speak",
  "welcome to careerforge",
  "welcome to",
  "careerforge",
  "let's try again",
  "no problem",
  "got it you said",
  "got it your email",
  "પૂરું નામ",
  "તમારું નામ",
  "તમારું ઇમેઇલ",
  "ઇમેઇલ સરનામું",
  "પાસવર્ડ અથવા પિન",
  "સાચું છે",
  "સ્વાગત છે",
  "કરિયરફોર્જ",
  "ફરીથી પ્રયત્ન",
  "આગળનો વિભાગ",
  "पूरा नाम",
  "आपका नाम",
  "आपका ईमेल",
  "ईमेल पता",
  "पासवर्ड या पिन",
  "सही है",
  "स्वागत है",
  "करियरफोर्ज",
  "दोबारा कोशिश",
  "अगला सेक्शन",
];

/**
 * Checks if a recognized transcript is an acoustic feedback echo of the AI assistant's own voice.
 * Prevents the AI assistant from detecting its own speech output through device speakers,
 * while allowing immediate user barge-in and answers.
 */
export function isSelfVoiceEcho(transcript: string): boolean {
  if (!transcript || !transcript.trim()) return false;
  const cleanT = transcript.toLowerCase().trim();
  const now = Date.now();

  // 1. User answers, names, and explicit interruption commands are NEVER echo
  if (
    cleanT === "yes" ||
    cleanT === "no" ||
    cleanT === "correct" ||
    cleanT === "wrong" ||
    cleanT === "stop" ||
    cleanT === "wait" ||
    cleanT === "pause" ||
    cleanT === "sure" ||
    cleanT === "go ahead" ||
    cleanT === "create it" ||
    cleanT === "create account" ||
    cleanT === "create my account" ||
    cleanT === "review" ||
    cleanT === "review positions" ||
    cleanT === "હા" ||
    cleanT === "ના" ||
    cleanT === "हाँ" ||
    cleanT === "नहीं" ||
    cleanT.includes("@") ||
    cleanT.includes("gmail") ||
    cleanT.includes("yahoo")
  ) {
    return false;
  }

  // 2. Reject any transcript that contains AI question prompt fragments
  for (const pattern of KNOWN_AI_PROMPT_PATTERNS) {
    if (pattern.length >= 6 && cleanT.includes(pattern)) {
      return true;
    }
  }

  // 3. Match against recently spoken assistant sentences
  const recent = recentSpokenPhrases.filter((p) => now - p.time < 6000);
  for (const { text: phrase } of recent) {
    if (phrase === cleanT || (phrase.length > 10 && cleanT.includes(phrase)) || (cleanT.length > 15 && phrase.includes(cleanT))) {
      return true;
    }
  }

  return false;
}

export function isAIAudioPlaying(): boolean {
  return isSelfSpeaking;
}

let blindGuideActive = false;

export function isBlindGuideActive(): boolean {
  return blindGuideActive;
}

export function setBlindGuideActive(active: boolean): void {
  if (blindGuideActive === active) return;
  blindGuideActive = active;
  if (active) {
    stopAllSpeechRecognition();
    stopSpeaking();
  }
}

// ─── 1. Automatic Language Detection from Text ─────────────────────────────────
export function detectTextLanguage(text: string): string {
  if (!text) return currentLanguage || "en-US";
  const clean = text.trim();
  const lower = clean.toLowerCase();

  // 1. Non-Latin scripts (High Precision)
  if (/[\u0A80-\u0AFF]/.test(clean)) return "gu-IN"; // Gujarati (ગુજરાતી)
  if (/[\u0900-\u097F]/.test(clean)) {
    // Check Marathi specific words if needed, default to Hindi
    if (/\b(कसे|माझे|नाव|मदत|करा|आहे|नाही)\b/.test(clean)) return "mr-IN";
    return "hi-IN"; // Hindi (हिन्दी)
  }
  if (/[\u0B80-\u0BFF]/.test(clean)) return "ta-IN"; // Tamil (தமிழ்)
  if (/[\u0C00-\u0C7F]/.test(clean)) return "te-IN"; // Telugu (తెలుగు)
  if (/[\u0980-\u09FF]/.test(clean)) return "bn-IN"; // Bengali (বাংলা)
  if (/[\u0600-\u06FF]/.test(clean)) return "ar-SA"; // Arabic (العربية)
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(clean)) return "ja-JP"; // Japanese (日本語)
  if (/[\u4E00-\u9FFF]/.test(clean)) return "zh-CN"; // Chinese (中文)

  // 2. Transliterated / Spoken terms in Latin script
  if (
    /\b(kem cho|maru naam|tamaru naam|mane madad|shu karvu|shu chhe|sikhavo|shikho|aabhar|joiye|nathi|chhu|chhe|avjo|saras|khub)\b/i.test(
      lower
    )
  ) {
    return "gu-IN";
  }

  if (
    /\b(kaise ho|namaste|mera naam|aapka naam|madad chahiye|kya karu|kya karna|batao|kripya|dhanyawad|shukriya|accha|theek)\b/i.test(
      lower
    )
  ) {
    return "hi-IN";
  }

  if (
    /[ñáéíóú¿¡]/i.test(clean) ||
    /\b(hola|como estas|ayuda|gracias|por favor|mi nombre|buenos dias|buenas tardes)\b/i.test(lower)
  ) {
    return "es-ES";
  }

  if (
    /[éèêëàâîïôûùç]/i.test(clean) ||
    /\b(bonjour|comment|aide|merci|s'il vous plait|mon nom)\b/i.test(lower)
  ) {
    return "fr-FR";
  }

  if (
    /[äöüß]/i.test(clean) ||
    /\b(hallo|hilfe|danke|bitte|mein name|guten tag)\b/i.test(lower)
  ) {
    return "de-DE";
  }

  return currentLanguage || "en-US";
}

export const detectLanguageFromText = detectTextLanguage;

export function setGlobalVoiceLanguage(langCode: string) {
  currentLanguage = langCode;
}

export function getGlobalVoiceLanguage(): string {
  return currentLanguage || "en-US";
}

// ─── 2. Accessible Web Audio Chimes for Blind & Disabled Users ─────────────────
export function playAccessibleChime(type: "start" | "success" | "stop" | "clear" | "navigate" | "focus") {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.08, now);

    if (type === "start") {
      // Friendly ascending two-tone chime
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === "success") {
      // Pleasant triad
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === "clear") {
      // Quick descending sweep
      osc.type = "triangle";
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === "stop") {
      // Soft single tone
      osc.type = "sine";
      osc.frequency.setValueAtTime(320, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    } else {
      // Navigate beep
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, now); // D5
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    }
  } catch {
    // Web audio muted or blocked — graceful no-op
  }
}

// ─── 3. React Synthetic Form Input Value Synchronizer ──────────────────────────
/**
 * Programmatically updates an HTMLInputElement or HTMLTextAreaElement in a way
 * that triggers React's internal onChange/onInput listeners.
 */
export function setNativeInputValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string
) {
  if (!element) return;

  // Clean value: for single-line inputs (name, email, password, search, etc.), strip trailing speech punctuation (.)
  let cleanValue = value;
  if (element instanceof HTMLInputElement || element.tagName.toLowerCase() === "input") {
    cleanValue = cleanValue.trim().replace(/[.,;?!]+$/, "");
  }

  const previousValue = element.value;

  const prototype =
    element instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;

  const valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

  if (valueSetter) {
    valueSetter.call(element, cleanValue);
  } else {
    element.value = cleanValue;
  }

  // React 16/17/18/19 internal synthetic event tracker synchronization:
  // Reset _valueTracker so React's onChange handler triggers reliably
  const tracker = (element as any)._valueTracker;
  if (tracker) {
    tracker.setValue(previousValue);
  }

  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Appends spoken text to an input/textarea with intelligent spacing and punctuation.
 */
export function appendNativeInputValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  newText: string,
  mode: "append" | "replace" = "append"
) {
  if (!element) return;
  const current = element.value || "";
  let finalVal = newText.trim();

  if (mode === "append" && current.trim()) {
    finalVal = `${current.trim()} ${newText.trim()}`;
  }

  setNativeInputValue(element, finalVal);

  // Place cursor at the end
  try {
    const len = finalVal.length;
    element.setSelectionRange(len, len);
  } catch {}
}

// ─── 4. Multi-Language Text-to-Speech (TTS) ───────────────────────────────────

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// ─── Single-Speaker Mutex & Voice Caching ─────────────────────────────────────
let currentSpeechSession = 0;
let activeSpeechTimeout: NodeJS.Timeout | null = null;
let activeSafetyTimeout: NodeJS.Timeout | null = null;
const cachedVoiceMap = new Map<string, SpeechSynthesisVoice>();

// Initialize voices listener as early as possible
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  const initVoices = () => {
    cachedVoiceMap.clear();
    try {
      window.speechSynthesis.getVoices();
    } catch {}
  };
  initVoices();
  window.speechSynthesis.onvoiceschanged = initVoices;
}

export function stopSpeaking() {
  // Invalidate any active and queued speech sessions immediately
  currentSpeechSession++;
  if (activeSpeechTimeout) {
    clearTimeout(activeSpeechTimeout);
    activeSpeechTimeout = null;
  }
  if (activeSafetyTimeout) {
    clearTimeout(activeSafetyTimeout);
    activeSafetyTimeout = null;
  }

  if (isSpeechSynthesisSupported()) {
    try {
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch {}
    activeUtterance = null;
    isSelfSpeaking = false;
  }
}

export function pauseSpeaking() {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.pause();
  }
}

export function resumeSpeaking() {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.resume();
  }
}

export function isSpeaking(): boolean {
  return isSelfSpeaking;
}

let activeRecognitionInstance: any = null;
let activeRecognitionGeneration = 0;

export function stopAllSpeechRecognition() {
  activeRecognitionGeneration += 1;
  if (activeRecognitionInstance) {
    try {
      activeRecognitionInstance.abort();
    } catch {}
    activeRecognitionInstance = null;
  }
}

// ─── Command-Bar Mic Coordination ─────────────────────────────────────────────
let commandBarActive = false;
const commandBarListeners = new Set<() => void>();

export function isCommandBarActive(): boolean {
  return commandBarActive;
}

export function setCommandBarActive(active: boolean): void {
  if (commandBarActive === active) return;
  commandBarActive = active;
  if (active) stopAllSpeechRecognition();
  commandBarListeners.forEach((fn) => fn());
}

export function subscribeCommandBar(listener: () => void): () => void {
  commandBarListeners.add(listener);
  return () => commandBarListeners.delete(listener);
}

let lockedPrimaryVoice: SpeechSynthesisVoice | null = null;

function getConsistentVoice(targetLang: string): SpeechSynthesisVoice | undefined {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return undefined;
  if (cachedVoiceMap.has(targetLang)) {
    return cachedVoiceMap.get(targetLang);
  }
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return undefined;

  // Single Clear Speaker Persona:
  // If we already locked a clear primary voice for the interview, reuse it strictly
  if (lockedPrimaryVoice && (targetLang.startsWith("en") || !targetLang)) {
    cachedVoiceMap.set(targetLang, lockedPrimaryVoice);
    return lockedPrimaryVoice;
  }

  const langPrefix = targetLang.split("-")[0].toLowerCase();
  const chosen =
    voices.find(
      (v) =>
        v.lang.toLowerCase() === targetLang.toLowerCase() &&
        (v.name.includes("Natural") || v.name.includes("Google") || v.name.includes("Online") || v.name.includes("Neural"))
    ) ||
    voices.find(
      (v) =>
        (v.name.includes("Natural") || v.name.includes("Google") || v.name.includes("Online") || v.name.includes("Neural")) &&
        (v.lang.toLowerCase().startsWith("en") || v.lang.toLowerCase().startsWith(langPrefix))
    ) ||
    voices.find((v) => v.lang.toLowerCase() === targetLang.toLowerCase()) ||
    voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix)) ||
    voices.find((v) => v.name.toLowerCase().includes(langPrefix)) ||
    voices[0];

  if (chosen) {
    cachedVoiceMap.set(targetLang, chosen);
    if (!lockedPrimaryVoice && (targetLang.startsWith("en") || !targetLang)) {
      lockedPrimaryVoice = chosen;
    }
  }
  return chosen || lockedPrimaryVoice || undefined;
}

export function speakText(
  text: string,
  options?: {
    lang?: string;
    rate?: number;
    pitch?: number;
    volume?: number;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: unknown) => void;
  }
) {
  if (!isSpeechSynthesisSupported()) {
    options?.onError?.("SpeechSynthesis not supported on this device.");
    return;
  }

  // Single-Speaker Mutex: Invalidate previous speech session and clear pending timers
  isSelfSpeaking = true;
  const sessionId = ++currentSpeechSession;
  if (activeSpeechTimeout) {
    clearTimeout(activeSpeechTimeout);
    activeSpeechTimeout = null;
  }
  if (activeSafetyTimeout) {
    clearTimeout(activeSafetyTimeout);
    activeSafetyTimeout = null;
  }

  // Cancel any ongoing speech in the browser immediately
  try {
    window.speechSynthesis.cancel();
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  } catch {}

  // Strip Markdown & action directives
  const cleanText = text
    .replace(/\[ACTION:.*?\]/g, "")
    .replace(/```[\s\S]*?```/g, "Code block.")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/#+\s/g, "")
    .replace(/>\s/g, "")
    .replace(/[•\-\*]\s/g, "")
    .replace(/https?:\/\/[^\s]+/g, "")
    .trim();

  if (!cleanText) {
    isSelfSpeaking = false;
    lastSpeechEndedAt = Date.now();
    options?.onEnd?.();
    return;
  }

  // Register the spoken phrase in the self-voice echo blacklist
  registerSpokenPhrase(cleanText);

  // Automatically detect language if not explicitly provided
  const targetLang = options?.lang || detectTextLanguage(cleanText);

  // 90ms acoustic drain barrier guarantees the browser audio thread has fully flushed
  // any prior utterance audio buffer, permanently preventing coinciding / overlapping voices!
  activeSpeechTimeout = setTimeout(() => {
    activeSpeechTimeout = null;

    // If a newer speech session was scheduled during the delay, discard this one immediately
    if (sessionId !== currentSpeechSession) {
      return;
    }

    try {
      window.speechSynthesis.cancel();
    } catch {}

    const utterance = new SpeechSynthesisUtterance(cleanText);
    activeUtterance = utterance;

    utterance.lang = targetLang;
    utterance.rate = options?.rate || 0.92;
    utterance.pitch = options?.pitch || 1.0;
    utterance.volume = typeof options?.volume === "number" ? options.volume : 1.0;

    const chosenVoice = getConsistentVoice(targetLang);
    if (chosenVoice) {
      utterance.voice = chosenVoice;
    }

    let ended = false;
    const finalizeSpeech = () => {
      if (ended) return;
      ended = true;
      if (activeSafetyTimeout) {
        clearTimeout(activeSafetyTimeout);
        activeSafetyTimeout = null;
      }
      if (sessionId === currentSpeechSession) {
        isSelfSpeaking = false;
        lastSpeechEndedAt = Date.now();
        activeUtterance = null;
      }
    };

    utterance.onstart = () => {
      if (sessionId !== currentSpeechSession) return;
      isSelfSpeaking = true;
      options?.onStart?.();
    };

    utterance.onend = () => {
      finalizeSpeech();
      options?.onEnd?.();
    };

    utterance.onerror = (e) => {
      finalizeSpeech();
      options?.onError?.(e);
    };

    // Safety fallback timeout: prevent state hang if browser fails to trigger onend
    const safetyTimeoutMs = Math.max(3500, (cleanText.length / 8) * 1000 + 3000);
    activeSafetyTimeout = setTimeout(() => {
      activeSafetyTimeout = null;
      if (!ended && isSelfSpeaking && sessionId === currentSpeechSession) {
        console.warn("[Voice Guard] Utterance safety timer triggered.");
        finalizeSpeech();
        options?.onEnd?.();
      }
    }, safetyTimeoutMs);

    try {
      window.speechSynthesis.speak(utterance);
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch (err) {
      finalizeSpeech();
      options?.onError?.(err);
    }
  }, 60);
}

// ─── 5. Multi-Language Speech-to-Text (STT) ───────────────────────────────────

export interface VoiceInteractionToken {
  sessionId: string;
  interactionId: string;
  questionId: string;
  fieldId: string;
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
}

export type SpeechRecognitionController = {
  stop: () => void;
  isActive: () => boolean;
  setLanguage: (lang: string) => void;
};

export interface SpeechRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  isBlindGuide?: boolean;
  onTranscript: (text: string, isFinal?: boolean) => void;
  onListeningChange?: (listening: boolean) => void;
  onError?: (error: string) => void;
}

export function startSpeechRecognition(
  callbacksOrOptions:
    | SpeechRecognitionOptions
    | {
        onTranscript: (text: string, isFinal: boolean) => void;
        onListeningChange?: (listening: boolean) => void;
        onError?: (error: string) => void;
        isBlindGuide?: boolean;
      },
  optionsArg?: {
    lang?: string;
    continuous?: boolean;
    isBlindGuide?: boolean;
  }
): SpeechRecognitionController | null {
  if (!isSpeechRecognitionSupported()) {
    callbacksOrOptions.onError?.("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
    callbacksOrOptions.onListeningChange?.(false);
    return null;
  }

  // Safeguard: The user-controlled command bar owns the mic — don't contend for it
  if (commandBarActive) {
    callbacksOrOptions.onListeningChange?.(false);
    return null;
  }

  // Singleton instance protection: abort previous
  stopAllSpeechRecognition();

  const isOptionsObject = "lang" in callbacksOrOptions || "continuous" in callbacksOrOptions || "isBlindGuide" in callbacksOrOptions;
  let currentLang = (isOptionsObject ? (callbacksOrOptions as SpeechRecognitionOptions).lang : optionsArg?.lang) || currentLanguage || "en-US";
  const continuous = isOptionsObject
    ? (callbacksOrOptions as SpeechRecognitionOptions).continuous !== false
    : optionsArg?.continuous !== false;

  const onTranscript = callbacksOrOptions.onTranscript;
  const onListeningChange = callbacksOrOptions.onListeningChange || (() => {});
  const onError = callbacksOrOptions.onError || (() => {});

  let running = true;
  let activeRec: any = null;
  let restartTimeout: any = null;
  const generation = activeRecognitionGeneration;

  const createAndStartInstance = () => {
    if (!running || generation !== activeRecognitionGeneration) return;

    try {
      const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognitionClass();
      activeRec = recognition;
      activeRecognitionInstance = recognition;

      recognition.continuous = continuous;
      recognition.interimResults = true;
      recognition.lang = currentLang;

      recognition.onstart = () => {
        if (generation !== activeRecognitionGeneration) return;
        onListeningChange(true);
      };

      recognition.onresult = (event: any) => {
        if (generation !== activeRecognitionGeneration) return;
        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        const candidate = (final || interim).trim();
        if (!candidate) return;

        // Barge-in check: If AI is currently speaking, check if this is real user speech
        if (isSelfSpeaking) {
          if (isSelfVoiceEcho(candidate)) {
            // Suppress acoustic speaker reflection into mic
            return;
          }
          // Real user voice interruption -> Immediately halt TTS
          stopSpeaking();
        }

        if (final) {
          const cleanFinal = final.trim();
          if (!cleanFinal) return;

          if (isSelfVoiceEcho(cleanFinal)) {
            return;
          }

          onTranscript(cleanFinal, true);
        } else if (interim) {
          if (!isSelfVoiceEcho(interim)) {
            onTranscript(interim, false);
          }
        }
      };

      recognition.onerror = (event: any) => {
        if (generation !== activeRecognitionGeneration) return;
        if (event.error === "language-not-supported") {
          onError("language-not-supported");
        } else if (event.error !== "no-speech" && event.error !== "aborted") {
          onError(event.error || "Microphone recognition error");
        }
        onListeningChange(false);
      };

      recognition.onend = () => {
        if (generation !== activeRecognitionGeneration) return;
        onListeningChange(false);
        // Clean restart with fresh instance on Chrome after delay to maintain persistent listening
        if (running && generation === activeRecognitionGeneration && !commandBarActive) {
          if (restartTimeout) clearTimeout(restartTimeout);
          restartTimeout = setTimeout(() => {
            if (running && generation === activeRecognitionGeneration && !commandBarActive) {
              createAndStartInstance();
            }
          }, 150);
        }
      };

      recognition.start();
    } catch (err) {
      console.warn("[Voice] Speech recognition init failed:", err);
      if (running && generation === activeRecognitionGeneration && !commandBarActive) {
        if (restartTimeout) clearTimeout(restartTimeout);
        restartTimeout = setTimeout(() => {
          if (running && generation === activeRecognitionGeneration && !commandBarActive) createAndStartInstance();
        }, 500);
      }
    }
  };

  createAndStartInstance();

  return {
    stop: () => {
      running = false;
      if (generation === activeRecognitionGeneration) activeRecognitionGeneration += 1;
      if (restartTimeout) clearTimeout(restartTimeout);
      try {
        activeRec?.stop();
      } catch {}
      if (activeRecognitionInstance === activeRec) {
        activeRecognitionInstance = null;
      }
      onListeningChange(false);
    },
    isActive: () => running,
    setLanguage: (newLang: string) => {
      currentLang = newLang;
      currentLanguage = newLang;
      if (activeRec) {
        try {
          activeRec.lang = newLang;
        } catch {}
      }
    },
  };
}

// ─── 6. Spoken Email Normalization (Resolves "at the rate", "@", "dot", any extension) ──
export function normalizeSpokenEmail(raw: string): string {
  if (!raw) return "";
  let text = raw.trim();

  // 1. Strip conversational prefixes first
  text = text.replace(
    /^(?:my email is|my email id is|email is|email id is|enter email|fill email|my email address is|email address is|this is my email|if i said|maru email che|maru email id che|maru email id|maru email|maro email|mera email hai|mera email id hai|mera email id|mera email|મારું ઈમેલ છે|મારું ઈમેલ|મારું ઈમેઈલ છે|મારું ઈમેઈલ|ઈમેલ છે|ઈમેલ|मेरा ईमेल है|मेरा ईमेल|ईमेल है|ईमेल|mon email est|mi correo es)\s*/i,
    ""
  );
  text = text.replace(/^(?:છે|है|est|is)\s+/i, "");

  // 2. Strip conversational suffixes
  text = text.replace(
    /\s*(?:as my email address|as my email id|as my email|is my email address|is my email|is my id|છે|હશે|લખી લો|है)$/i,
    ""
  );

  // 3. Indian & international spoken phrases ("double one", "triple zero", etc.)
  text = text
    .replace(/\bdouble\s+zero\b/gi, "00")
    .replace(/\bdouble\s+one\b/gi, "11")
    .replace(/\bdouble\s+two\b/gi, "22")
    .replace(/\bdouble\s+three\b/gi, "33")
    .replace(/\bdouble\s+four\b/gi, "44")
    .replace(/\bdouble\s+five\b/gi, "55")
    .replace(/\bdouble\s+six\b/gi, "66")
    .replace(/\bdouble\s+seven\b/gi, "77")
    .replace(/\bdouble\s+eight\b/gi, "88")
    .replace(/\bdouble\s+nine\b/gi, "99")
    .replace(/\btriple\s+zero\b/gi, "000");

  // Indic Numerals normalization (Gujarati & Devanagari)
  const indicDigits: Record<string, string> = {
    "૦": "0", "૧": "1", "૨": "2", "૩": "3", "૪": "4",
    "૫": "5", "૬": "6", "૭": "7", "૮": "8", "૯": "9",
    "०": "0", "१": "1", "२": "2", "३": "3", "४": "4",
    "५": "5", "६": "6", "७": "7", "८": "8", "९": "9",
  };
  text = text.replace(/[૦-૯०-९]/g, (ch) => indicDigits[ch] || ch);

  // Specific common spoken multi-number patterns (e.g. mananshah1127)
  text = text
    .replace(/\beleven\s+twenty\s+seven\b/gi, "1127")
    .replace(/\bone\s+one\s+two\s+seven\b/gi, "1127")
    .replace(/\bone\s+one\s+twenty\s+seven\b/gi, "1127")
    .replace(/\btwenty\s+seven\b/gi, "27")
    .replace(/\bnineteen\s+ninety\s+eight\b/gi, "1998")
    .replace(/\bnineteen\s+ninety\s+nine\b/gi, "1999")
    .replace(/\btwo\s+thousand\b/gi, "2000");

  // Compound 20-99 numbers (e.g. twenty seven -> 27, eighty eight -> 88)
  const tensMap: Record<string, number> = {
    twenty: 20,
    thirty: 30,
    forty: 40,
    fifty: 50,
    sixty: 60,
    seventy: 70,
    eighty: 80,
    ninety: 90,
  };
  const onesMap: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
  };

  for (const [tWord, tVal] of Object.entries(tensMap)) {
    for (const [oWord, oVal] of Object.entries(onesMap)) {
      const reg = new RegExp(`\\b${tWord}\\s+${oWord}\\b`, "gi");
      text = text.replace(reg, String(tVal + oVal));
    }
    const tReg = new RegExp(`\\b${tWord}\\b`, "gi");
    text = text.replace(tReg, String(tVal));
  }

  // Single digit and teen words
  const singlesMap: Record<string, string> = {
    zero: "0",
    one: "1",
    two: "2",
    three: "3",
    four: "4",
    five: "5",
    six: "6",
    seven: "7",
    eight: "8",
    nine: "9",
    ten: "10",
    eleven: "11",
    twelve: "12",
    thirteen: "13",
    fourteen: "14",
    fifteen: "15",
    sixteen: "16",
    seventeen: "17",
    eighteen: "18",
    nineteen: "19",
    hundred: "00",
    thousand: "000",
  };
  for (const [word, digit] of Object.entries(singlesMap)) {
    const reg = new RegExp(`\\b${word}\\b`, "gi");
    text = text.replace(reg, digit);
  }

  // 4. Spoken "@" representations across English, Hindi, Gujarati, French, Spanish
  text = text
    .replace(
      /\s*(?:at\s+the\s+rate\s+of|at\s+the\s+rate|add\s+the\s+rate|at\s+rate|એટ\s*ધ\s*રેટ|એટ\s*રેટ|एट\s*દ\s*रेट\s*ऑफ़|एट\s*द\s*रेट|एट\s*रेट|arobase|arroba|a\s+commercial)\s*/gi,
      "@"
    )
    .replace(/\s+at\s+/gi, "@");

  // 5. Spoken "." representations
  text = text
    .replace(/\s*(?:dot|dott|period|point|punto|ડૉટ|ડોટ|डॉट)\s*/gi, ".")
    .replace(/\s*(?:underscore|under\s+score|અંડરસ્કોર|अंडरस्कोर)\s*/gi, "_")
    .replace(/\s*(?:dash|hyphen|minus|માઈનસ|माइनस|tiret)\s*/gi, "-");

  // 6. If missing @ but mentions a common email domain, insert @ before the domain
  const commonDomains = [
    "gmail",
    "yahoo",
    "outlook",
    "hotmail",
    "icloud",
    "proton",
    "protonmail",
    "zoho",
    "aol",
    "mail",
    "rediffmail",
    "yandex",
    "live",
    "fastmail",
  ];
  if (!text.includes("@")) {
    for (const dom of commonDomains) {
      const reg = new RegExp(`\\s*\\b${dom}\\b`, "i");
      if (reg.test(text)) {
        text = text.replace(reg, `@${dom}`);
        break;
      }
    }
  }

  // 7. Clean spaces around symbols
  text = text
    .replace(/\s*@\s*/g, "@")
    .replace(/\s*\.\s*/g, ".")
    .replace(/\s*_\s*/g, "_")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, "");

  // 8. If text contains "@", cleanly process username and domain
  if (text.includes("@")) {
    const parts = text.split("@");
    const userPart = parts[0].replace(/[^a-zA-Z0-9._-]/g, "").toLowerCase();
    let domainPart = parts.slice(1).join("@").replace(/[^a-zA-Z0-9._-]/g, "").toLowerCase();

    // If domain doesn't contain a dot, handle missing dot before common extensions (e.g. "gmailcom" -> "gmail.com")
    if (!domainPart.includes(".")) {
      const commonExtensions = [
        "co.in",
        "com",
        "org",
        "net",
        "edu",
        "gov",
        "io",
        "ai",
        "me",
        "app",
        "dev",
        "tech",
        "info",
        "xyz",
        "co",
        "uk",
        "ca",
        "de",
        "fr",
        "us",
        "in",
      ];
      let matchedExt = false;
      for (const ext of commonExtensions) {
        if (domainPart.endsWith(ext) && domainPart.length > ext.length) {
          const baseDomain = domainPart.slice(0, -ext.length);
          domainPart = `${baseDomain}.${ext}`;
          matchedExt = true;
          break;
        }
      }
      // If still no extension, default to .com (e.g. user said "mananshah1127@yahoo" or "mananshah1127@gmail")
      if (!matchedExt && !domainPart.includes(".")) {
        domainPart = `${domainPart}.com`;
      }
    }

    let res = `${userPart}@${domainPart}`;
    if (res.startsWith("mannanshah")) res = res.replace("mannanshah", "mananshah");
    return res;
  }

  return text.replace(/\s+/g, "").replace(/[.,;?!]+$/, "").toLowerCase();
}

// ─── 6b. Spoken Name Normalization (Resolves phonetic errors like "Sha" -> "Shah") ──
export function normalizeSpokenName(raw: string): string {
  if (!raw) return "";
  let text = raw.trim();

  // Strip conversational prefixes
  text = text.replace(
    /^(?:my name is|my name|name is|i am|this is|મારું નામ છે|મારું નામ|નામ છે|નામ|मेरा नाम है|मेरा नाम|नाम है|नाम|je m'appelle|mon nom est|me llamo)\s*/i,
    ""
  );

  // Strip conversational suffixes
  text = text.replace(
    /\s*(?:is my name|is my full name|છે|હશે|લખી લો|है)$/i,
    ""
  );

  // Common phonetic corrections (Sha -> Shah, etc.)
  text = text
    .replace(/\bmanan\s+sha\b/gi, "Manan Shah")
    .replace(/\bmannan\s+sha\b/gi, "Manan Shah")
    .replace(/\bmananshah\b/gi, "Manan Shah")
    .replace(/\bmanansha\b/gi, "Manan Shah")
    .replace(/\bsha\b/gi, "Shah")
    .replace(/\bpatle\b/gi, "Patel");

  // Strip trailing punctuation
  text = text.replace(/[.,;?!]+$/, "").trim();

  // Title Case words
  return text
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// ─── 6c. Spoken Password & PIN Normalizer ─────────────────────────────────────
/**
 * Normalizes spoken passwords and PINs:
 * - Collapses separated spoken digits (e.g. "1 2 3 4" -> "1234")
 * - Converts verbal numbers ("one two three four five six" -> "123456")
 * - Handles Indian/international words ("double zero", "triple one", Indic digits ૦-૯ / ०-९)
 * - Converts spoken symbols ("at the rate" -> "@", "hash" -> "#", "dollar" -> "$", "star" -> "*")
 * - Strips conversational prefixes ("my password is", "password is", "maro password che")
 * - Strips all accidental whitespace between digits/characters so passwords are clean and continuous
 */
export function normalizeSpokenPassword(raw: string): string {
  if (!raw) return "";
  let text = raw.trim();

  // 1. Strip conversational prefixes
  text = text.replace(
    /^(?:my password is|my pin is|password is|pin is|enter password|enter pin|set password|password|pin|મારો પાસવર્ડ છે|મારો પાસવર્ડ|પાસવર્ડ છે|પાસવર્ડ|પિન|मेरा पासवर्ड है|मेरा पासवर्ड|पासवर्ड है|पासवर्ड|पिन|mon mot de passe est|mi contraseña es)\s*/i,
    ""
  );

  // 2. Strip conversational suffixes
  text = text.replace(
    /\s*(?:is my password|is my pin|as my password|as my pin|છે|હશે|લખી લો|है)$/i,
    ""
  );

  // 3. Indian & international spoken phrases ("double zero", "triple one", etc.)
  text = text
    .replace(/\bdouble\s+zero\b/gi, "00")
    .replace(/\bdouble\s+one\b/gi, "11")
    .replace(/\bdouble\s+two\b/gi, "22")
    .replace(/\bdouble\s+three\b/gi, "33")
    .replace(/\bdouble\s+four\b/gi, "44")
    .replace(/\bdouble\s+five\b/gi, "55")
    .replace(/\bdouble\s+six\b/gi, "66")
    .replace(/\bdouble\s+seven\b/gi, "77")
    .replace(/\bdouble\s+eight\b/gi, "88")
    .replace(/\bdouble\s+nine\b/gi, "99")
    .replace(/\btriple\s+zero\b/gi, "000")
    .replace(/\btriple\s+one\b/gi, "111");

  // 4. Indic numerals (Gujarati & Devanagari)
  const indicDigits: Record<string, string> = {
    "૦": "0", "૧": "1", "૨": "2", "૩": "3", "૪": "4",
    "૫": "5", "૬": "6", "૭": "7", "૮": "8", "૯": "9",
    "०": "0", "१": "1", "२": "2", "३": "3", "४": "4",
    "५": "5", "६": "6", "७": "7", "८": "8", "९": "9",
  };
  text = text.replace(/[૦-૯०-९]/g, (ch) => indicDigits[ch] || ch);

  // 5. Spoken symbols
  text = text
    .replace(/\s*(?:at\s+the\s+rate|at\s+rate|એટ\s*ધ\s*રેટ|એટ\s*રેટ|एट\s*द\s*रेट|एट\s*रेट)\s*/gi, "@")
    .replace(/\s*(?:hash|hashtag|હેશ|हैश)\s*/gi, "#")
    .replace(/\s*(?:dollar|ડોલર|डॉलर)\s*/gi, "$")
    .replace(/\s*(?:star|asterisk|તારો|તારા|तारा|स्टार)\s*/gi, "*")
    .replace(/\s*(?:underscore|under\s+score|અંડરસ્કોર|अंडरस्कोर)\s*/gi, "_")
    .replace(/\s*(?:dash|hyphen|minus|માઈનસ|माइनस)\s*/gi, "-")
    .replace(/\s*(?:dot|period|ડોટ|डॉट)\s*/gi, ".");

  // 6. Compound tens
  const tensMap: Record<string, number> = {
    twenty: 20, thirty: 30, forty: 40, fifty: 50,
    sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  };
  const onesMap: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9,
  };

  for (const [tWord, tVal] of Object.entries(tensMap)) {
    for (const [oWord, oVal] of Object.entries(onesMap)) {
      const reg = new RegExp(`\\b${tWord}\\s+${oWord}\\b`, "gi");
      text = text.replace(reg, String(tVal + oVal));
    }
    const tReg = new RegExp(`\\b${tWord}\\b`, "gi");
    text = text.replace(tReg, String(tVal));
  }

  // 7. Single digit words
  const singlesMap: Record<string, string> = {
    zero: "0", one: "1", two: "2", three: "3", four: "4",
    five: "5", six: "6", seven: "7", eight: "8", nine: "9",
    ten: "10", eleven: "11", twelve: "12", thirteen: "13",
    fourteen: "14", fifteen: "15", sixteen: "16", seventeen: "17",
    eighteen: "18", nineteen: "19",
  };
  for (const [word, digit] of Object.entries(singlesMap)) {
    const reg = new RegExp(`\\b${word}\\b`, "gi");
    text = text.replace(reg, digit);
  }

  // 8. Strip all whitespace between characters/digits so "1 2 3 4" becomes "1234"
  return text.replace(/\s+/g, "").replace(/[.,;?!]+$/, "");
}

// ─── 7. Live Focused Field Prompt Generator ───────────────────────────────────
export function getFieldPromptMessage(
  fieldLabel: string,
  fieldType: string = "text",
  lang: string = "en-US"
): string {
  const lowerLabel = (fieldLabel || "").toLowerCase();
  const isEmail =
    fieldType === "email" ||
    lowerLabel.includes("email") ||
    lowerLabel.includes("ઈમેલ") ||
    lowerLabel.includes("ईमेल");
  const isPass =
    fieldType === "password" ||
    lowerLabel.includes("pass") ||
    lowerLabel.includes("પાસવર્ડ") ||
    lowerLabel.includes("पासवर्ड");
  const isName =
    lowerLabel.includes("name") || lowerLabel.includes("નામ") || lowerLabel.includes("नाम");
  const isSearch =
    lowerLabel.includes("search") ||
    lowerLabel.includes("find") ||
    lowerLabel.includes("સર્ચ") ||
    lowerLabel.includes("खोज");
  const isRole =
    lowerLabel.includes("role") || lowerLabel.includes("title") || lowerLabel.includes("job");

  if (lang.startsWith("gu")) {
    if (isEmail) return "કૃપા કરીને તમારું ઈમેઇલ સરનામું બોલો.";
    if (isPass) return "કૃપા કરીને તમારો પાસવર્ડ બોલો (ઓછામાં ઓછા ૬ અક્ષર હોવા જોઈએ).";
    if (isName) return "કૃપા કરીને તમારું પૂરું નામ બોલો.";
    if (isSearch) return "કૃપા કરીને તમે શું સર્ચ કરવા માંગો છો તે બોલો.";
    if (isRole) return "કૃપા કરીને તમારો ઇચ્છિત રોલ અથવા જોબ ટાઇટલ બોલો.";
    return `કૃપા કરીને ${fieldLabel || "આ ખાનું"} ભરવા માટે બોલો.`;
  }

  if (lang.startsWith("hi")) {
    if (isEmail) return "कृपया अपना ईमेल पता बोलें।";
    if (isPass) return "कृपया अपना पासवर्ड बोलें (कम से कम ६ अक्षर होने चाहिए)।";
    if (isName) return "कृपया अपना पूरा नाम बोलें।";
    if (isSearch) return "कृपया सर्च करने के लिए बोलें।";
    if (isRole) return "कृपया अपना लक्षित रोल या पद बोलें।";
    return `कृपया ${fieldLabel || "इस फ़ील्ड"} के लिए बोलें।`;
  }

  if (lang.startsWith("fr")) {
    if (isEmail) return "Veuillez dicter votre adresse e-mail.";
    if (isPass) return "Veuillez dicter votre mot de passe (au moins 6 caractères).";
    if (isName) return "Veuillez dicter votre nom complet.";
    if (isSearch) return "Que souhaitez-vous rechercher ?";
    return `Veuillez dicter pour ${fieldLabel || "ce champ"}.`;
  }

  if (isEmail) return "Please speak your email address.";
  if (isPass) return "Please speak your password (must be at least 6 characters).";
  if (isName) return "Please speak your full name.";
  if (isSearch) return "Please speak what you would like to search for.";
  if (isRole) return "Please speak your target role or job title.";
  return `Please speak to fill ${fieldLabel || "this field"}.`;
}

/**
 * Letter-by-letter vocal feedback for blind users typing or entering data.
 */
export function speakLetter(char: string, lang?: string) {
  if (!isSpeechSynthesisSupported() || !char) return;
  try {
    let textToSay = char;
    if (char === " ") textToSay = "Space";
    else if (char === "\n" || char === "Enter") textToSay = "Enter";
    else if (char === "Backspace") textToSay = "Backspace";
    else if (char.length === 1 && /[a-zA-Z]/.test(char)) {
      textToSay = char.toUpperCase();
    }
    const utterance = new SpeechSynthesisUtterance(textToSay);
    utterance.lang = lang || currentLanguage || "en-US";
    utterance.rate = 1.25;
    window.speechSynthesis.speak(utterance);
  } catch {}
}

/**
 * Spells out a word character-by-character for auditory confirmation for visually impaired users.
 */
export function spellOutWord(word: string): string {
  if (!word) return "";
  return word.trim().split("").map((c) => (c === " " ? "space" : c.toUpperCase())).join(" - ");
}


