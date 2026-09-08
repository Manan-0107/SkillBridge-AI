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

/**
 * Checks if a recognized transcript is an acoustic feedback echo of the AI assistant's own voice.
 * Prevents the AI assistant from detecting its own speech output through device speakers.
 */
export function isSelfVoiceEcho(transcript: string): boolean {
  if (!transcript || !transcript.trim()) return false;
  const cleanT = transcript.toLowerCase().trim();
  const now = Date.now();

  // 1. Any incoming audio while AI is speaking or within 800ms cooldown is self-voice echo
  if (isSelfSpeaking || now - lastSpeechEndedAt < 800) {
    return true;
  }

  // 2. Common user answers, emails, names, and single words are NEVER an echo after the 800ms cooldown
  if (
    cleanT.length < 16 ||
    cleanT.includes("@") ||
    cleanT.includes("gmail") ||
    cleanT === "yes" ||
    cleanT === "no" ||
    cleanT === "correct" ||
    cleanT === "wrong" ||
    cleanT === "હા" ||
    cleanT === "ના" ||
    cleanT === "हाँ" ||
    cleanT === "नहीं"
  ) {
    return false;
  }

  // 3. Only match complete verbatim sentences matching the AI question spoken within 4 seconds
  const recent = recentSpokenPhrases.filter((p) => now - p.time < 4000);
  for (const { text: phrase } of recent) {
    if (phrase === cleanT || (cleanT.length > 25 && phrase.includes(cleanT))) {
      return true;
    }
  }

  return false;
}

export function isAIAudioPlaying(): boolean {
  return isSelfSpeaking || Date.now() - lastSpeechEndedAt < 800;
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

export function stopSpeaking() {
  if (isSpeechSynthesisSupported()) {
    try {
      window.speechSynthesis.cancel();
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

export function stopAllSpeechRecognition() {
  if (activeRecognitionInstance) {
    try {
      activeRecognitionInstance.abort();
    } catch {}
    activeRecognitionInstance = null;
  }
}

// ─── Command-Bar Mic Coordination ─────────────────────────────────────────────
// The floating voice command bar (context/VoiceContext.tsx) is the one mic the
// user explicitly controls. While it's active, every other recognizer parks —
// the ambient activation probe, the dictator, chat/practice dictation — so a
// click on START isn't instantly aborted by a competing SpeechRecognition.
// ponytail: coordination flag, not a cure. The cure is one shared recognizer.
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

  // 1. ABSOLUTE MICROPHONE SHUTDOWN BEFORE TTS
  stopAllSpeechRecognition();
  isSelfSpeaking = true;

  // Cancel any ongoing speech and ensure synthesis engine is active
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

  const utterance = new SpeechSynthesisUtterance(cleanText);
  activeUtterance = utterance;

  utterance.lang = targetLang;
  utterance.rate = options?.rate || 0.98;
  utterance.pitch = options?.pitch || 1.0;
  utterance.volume = typeof options?.volume === "number" ? options.volume : 1.0;

  // Find the highest quality native voice matching the language exactly
  const voices = window.speechSynthesis.getVoices();
  const langPrefix = targetLang.split("-")[0].toLowerCase();

  const matchingVoice =
    voices.find((v) => v.lang.toLowerCase() === targetLang.toLowerCase()) ||
    voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix)) ||
    voices.find((v) => v.name.toLowerCase().includes(langPrefix)) ||
    voices.find((v) => v.name.includes("Google") || v.name.includes("Natural")) ||
    voices[0];

  if (matchingVoice) {
    utterance.voice = matchingVoice;
  }

  let ended = false;
  const finalizeSpeech = () => {
    if (ended) return;
    ended = true;
    isSelfSpeaking = false;
    lastSpeechEndedAt = Date.now();
    activeUtterance = null;
  };

  utterance.onstart = () => {
    isSelfSpeaking = true;
    stopAllSpeechRecognition();
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
  const safetyTimeoutMs = Math.max(3500, (cleanText.length / 10) * 1000 + 3000);
  setTimeout(() => {
    if (!ended && isSelfSpeaking) {
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
}

// ─── 5. Multi-Language Speech-to-Text (STT) ───────────────────────────────────

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
}

export type SpeechRecognitionController = {
  stop: () => void;
  isActive: () => boolean;
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

  // Safeguard 1: NEVER listen while AI is speaking or within 800ms post-speech echo cooldown
  if (isSelfSpeaking || Date.now() - lastSpeechEndedAt < 800) {
    console.warn("[Voice Guard] Cannot start speech recognition during AI speech or echo cooldown.");
    callbacksOrOptions.onListeningChange?.(false);
    return null;
  }

  const isOptionsObject = "lang" in callbacksOrOptions || "continuous" in callbacksOrOptions || "isBlindGuide" in callbacksOrOptions;
  const isBlindGuide = isOptionsObject
    ? !!(callbacksOrOptions as SpeechRecognitionOptions).isBlindGuide
    : !!optionsArg?.isBlindGuide;

  // Safeguard 2: The user-controlled command bar owns the mic — don't contend for it
  if (commandBarActive) {
    callbacksOrOptions.onListeningChange?.(false);
    return null;
  }

  // Singleton instance protection: abort previous
  stopAllSpeechRecognition();

  const lang = (isOptionsObject ? (callbacksOrOptions as SpeechRecognitionOptions).lang : optionsArg?.lang) || currentLanguage || "en-US";
  const continuous = isOptionsObject
    ? (callbacksOrOptions as SpeechRecognitionOptions).continuous !== false
    : optionsArg?.continuous !== false;

  const onTranscript = callbacksOrOptions.onTranscript;
  const onListeningChange = callbacksOrOptions.onListeningChange || (() => {});
  const onError = callbacksOrOptions.onError || (() => {});

  let running = true;
  let activeRec: any = null;
  let restartTimeout: any = null;

  const createAndStartInstance = () => {
    if (!running || isSelfSpeaking) return;

    try {
      const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognitionClass();
      activeRec = recognition;
      activeRecognitionInstance = recognition;

      recognition.continuous = continuous;
      recognition.interimResults = true;
      recognition.lang = lang;

      recognition.onstart = () => {
        onListeningChange(true);
      };

      recognition.onresult = (event: any) => {
        // Safeguard: If AI is speaking or in post-speech cooldown (800ms), drop
        if (isSelfSpeaking || Date.now() - lastSpeechEndedAt < 800) {
          return;
        }

        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (final) {
          const cleanFinal = final.trim();
          if (!cleanFinal) return;

          if (isSelfVoiceEcho(cleanFinal)) {
            console.warn("[Voice Guard] Suppressed self-voice acoustic echo:", cleanFinal);
            return;
          }

          const detected = detectTextLanguage(cleanFinal);
          currentLanguage = detected;
          onTranscript(cleanFinal, true);
        } else if (interim) {
          if (!isSelfSpeaking && Date.now() - lastSpeechEndedAt >= 800) {
            if (!isSelfVoiceEcho(interim)) {
              onTranscript(interim, false);
            }
          }
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error !== "no-speech" && event.error !== "aborted") {
          onError(event.error || "Microphone recognition error");
        }
        onListeningChange(false);
      };

      recognition.onend = () => {
        onListeningChange(false);
        // Clean restart with fresh instance on Chrome after delay
        if (running && !isSelfSpeaking && !commandBarActive) {
          if (restartTimeout) clearTimeout(restartTimeout);
          restartTimeout = setTimeout(() => {
            if (running && !isSelfSpeaking && !commandBarActive) {
              createAndStartInstance();
            }
          }, 150);
        }
      };

      recognition.start();
    } catch (err) {
      console.warn("[Voice] Speech recognition init failed:", err);
      if (running && !isSelfSpeaking) {
        if (restartTimeout) clearTimeout(restartTimeout);
        restartTimeout = setTimeout(() => {
          if (running && !isSelfSpeaking) createAndStartInstance();
        }, 500);
      }
    }
  };

  createAndStartInstance();

  return {
    stop: () => {
      running = false;
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
  };
}

// ─── 6. Spoken Email Normalization (Resolves "at the rate", "@", "dot", etc.) ──
export function normalizeSpokenEmail(raw: string): string {
  if (!raw) return "";
  let text = raw.trim();

  // 1. Strip conversational prefixes first
  text = text.replace(
    /^(?:my email is|my email id is|email is|email id is|enter email|fill email|my email address is|email address is|this is my email|if i said|મારું ઈમેલ છે|મારું ઈમેલ|મારું ઈમેઈલ છે|મારું ઈમેઈલ|ઈમેલ છે|ઈમેલ|मेरा ईमेल है|मेरा ईमेल|ईमेल है|ईमेल|mon email est|mi correo es)\s*/i,
    ""
  );
  text = text.replace(/^(?:છે|है|est|is)\s+/i, "");

  // 2. Strip conversational suffixes
  text = text.replace(
    /\s*(?:as my email address|as my email id|as my email|is my email address|is my email|is my id|છે|હશે|લખી લો|है)$/i,
    ""
  );

  // 3. Spoken number words to digits (e.g. eleven twenty seven -> 1127)
  text = text
    .replace(/\beleven\s+twenty\s+seven\b/gi, "1127")
    .replace(/\btwenty\s+seven\b/gi, "27")
    .replace(/\bone\s+one\s+two\s+seven\b/gi, "1127")
    .replace(/\bzero\b/gi, "0")
    .replace(/\bone\b/gi, "1")
    .replace(/\btwo\b/gi, "2")
    .replace(/\bthree\b/gi, "3")
    .replace(/\bfour\b/gi, "4")
    .replace(/\bfive\b/gi, "5")
    .replace(/\bsix\b/gi, "6")
    .replace(/\bseven\b/gi, "7")
    .replace(/\beight\b/gi, "8")
    .replace(/\bnine\b/gi, "9")
    .replace(/\bten\b/gi, "10")
    .replace(/\beleven\b/gi, "11")
    .replace(/\btwelve\b/gi, "12")
    .replace(/\bthirteen\b/gi, "13")
    .replace(/\bfourteen\b/gi, "14")
    .replace(/\bfifteen\b/gi, "15")
    .replace(/\bsixteen\b/gi, "16")
    .replace(/\bseventeen\b/gi, "17")
    .replace(/\beighteen\b/gi, "18")
    .replace(/\bnineteen\b/gi, "19")
    .replace(/\btwenty\b/gi, "20");

  // 4. Spoken "@" representations across English, Hindi, Gujarati, French, Spanish
  text = text
    .replace(
      /\s*(?:at\s+the\s+rate\s+of|at\s+the\s+rate|add\s+the\s+rate|at\s+rate|એટ\s*ધ\s*રેટ|એટ\s*રેટ|एट\s*द\s*रेट\s*ऑफ़|एट\s*द\s*रेट|एट\s*रेट|arobase|arroba|a\s+commercial)\s*/gi,
      "@"
    )
    .replace(/\s+at\s+/gi, "@");

  // 5. Spoken "." representations
  text = text
    .replace(/\s*(?:dot|dott|डॉट|ડૉટ|point|punto)\s*/gi, ".")
    .replace(/\s*\.\s*/g, ".");

  text = text
    .replace(/\s*(?:underscore|અંડરસ્કોર|अंडरस्कोर)\s*/gi, "_")
    .replace(/\s*(?:dash|hyphen|માઈનસ|माइनस|tiret)\s*/gi, "-");

  // 4. Remove internal whitespace around @ and .
  text = text
    .replace(/\s*@\s*/g, "@")
    .replace(/\s*\.\s*/g, ".")
    .replace(/\s+/g, "");

  // 5. Common domain corrections if STT split it
  text = text
    .replace(/@g\s*mail/i, "@gmail")
    .replace(/@y\s*ahoo/i, "@yahoo")
    .replace(/@out\s*look/i, "@outlook")
    .replace(/@hot\s*mail/i, "@hotmail")
    .replace(/\.c\s*om/i, ".com")
    .replace(/\.i\s*n/i, ".in")
    .replace(/\.o\s*rg/i, ".org")
    .replace(/\.e\s*du/i, ".edu")
    .replace(/\.n\s*et/i, ".net");

  // If text contains "@", remove all spaces before and after "@"
  if (text.includes("@")) {
    const parts = text.split("@");
    const userPart = parts[0].replace(/\s+/g, "").toLowerCase();
    const domainPart = parts.slice(1).join("@").replace(/\s+/g, "").toLowerCase();
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
    if (isPass) return "કૃપા કરીને તમારો પાસવર્ડ બોલો.";
    if (isName) return "કૃપા કરીને તમારું પૂરું નામ બોલો.";
    if (isSearch) return "કૃપા કરીને તમે શું સર્ચ કરવા માંગો છો તે બોલો.";
    if (isRole) return "કૃપા કરીને તમારો ઇચ્છિત રોલ અથવા જોબ ટાઇટલ બોલો.";
    return `કૃપા કરીને ${fieldLabel || "આ ખાનું"} ભરવા માટે બોલો.`;
  }

  if (lang.startsWith("hi")) {
    if (isEmail) return "कृपया अपना ईमेल पता बोलें।";
    if (isPass) return "कृपया अपना पासवर्ड बोलें।";
    if (isName) return "कृपया अपना पूरा नाम बोलें।";
    if (isSearch) return "कृपया सर्च करने के लिए बोलें।";
    if (isRole) return "कृपया अपना लक्षित रोल या पद बोलें।";
    return `कृपया ${fieldLabel || "इस फ़ील्ड"} के लिए बोलें।`;
  }

  if (lang.startsWith("fr")) {
    if (isEmail) return "Veuillez dicter votre adresse e-mail.";
    if (isPass) return "Veuillez dicter votre mot de passe.";
    if (isName) return "Veuillez dicter votre nom complet.";
    if (isSearch) return "Que souhaitez-vous rechercher ?";
    return `Veuillez dicter pour ${fieldLabel || "ce champ"}.`;
  }

  if (isEmail) return "Please speak your email address.";
  if (isPass) return "Please speak your password.";
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


