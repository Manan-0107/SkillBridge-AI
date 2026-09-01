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
let speechCooldownUntil = 0;

export function isAIAudioPlaying(): boolean {
  if (typeof window === "undefined") return false;
  return isSelfSpeaking || (window.speechSynthesis && window.speechSynthesis.speaking) || Date.now() < speechCooldownUntil;
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
  // Gujarati Transliteration
  if (
    /\b(kem cho|maru naam|tamaru naam|mane madad|shu karvu|shu chhe|sikhavo|shikho|aabhar|joiye|nathi|chhu|chhe|avjo|saras|khub)\b/i.test(
      lower
    )
  ) {
    return "gu-IN";
  }

  // Hindi Transliteration
  if (
    /\b(kaise ho|namaste|mera naam|aapka naam|madad chahiye|kya karu|kya karna|batao|kripya|dhanyawad|shukriya|accha|theek)\b/i.test(
      lower
    )
  ) {
    return "hi-IN";
  }

  // Spanish
  if (
    /[ñáéíóú¿¡]/i.test(clean) ||
    /\b(hola|como estas|ayuda|gracias|por favor|mi nombre|buenos dias|buenas tardes)\b/i.test(lower)
  ) {
    return "es-ES";
  }

  // French
  if (
    /[éèêëàâîïôûùç]/i.test(clean) ||
    /\b(bonjour|comment|aide|merci|s'il vous plait|mon nom)\b/i.test(lower)
  ) {
    return "fr-FR";
  }

  // German
  if (
    /[äöüß]/i.test(clean) ||
    /\b(hallo|hilfe|danke|bitte|mein name|guten tag)\b/i.test(lower)
  ) {
    return "de-DE";
  }

  // 3. Default to current language or English
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
export function playAccessibleChime(type: "start" | "success" | "stop" | "clear" | "navigate") {
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
  const prototype =
    element instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;

  const valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;

  if (valueSetter) {
    valueSetter.call(element, value);
  } else {
    element.value = value;
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
    window.speechSynthesis.cancel();
    activeUtterance = null;
    isSelfSpeaking = false;
    speechCooldownUntil = 0;
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
  if (!isSpeechSynthesisSupported()) return false;
  return isSelfSpeaking || window.speechSynthesis.speaking;
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

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

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
    options?.onEnd?.();
    return;
  }

  // Automatically detect language if not explicitly provided
  const targetLang = options?.lang || detectTextLanguage(cleanText);

  const utterance = new SpeechSynthesisUtterance(cleanText);
  activeUtterance = utterance;
  isSelfSpeaking = true;

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

  const finalizeSpeech = () => {
    isSelfSpeaking = false;
    speechCooldownUntil = Date.now() + 800; // 800ms cooldown buffer
    activeUtterance = null;
  };

  utterance.onstart = () => {
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

  window.speechSynthesis.speak(utterance);
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
      },
  optionsArg?: {
    lang?: string;
    continuous?: boolean;
  }
): SpeechRecognitionController | null {
  if (!isSpeechRecognitionSupported()) {
    callbacksOrOptions.onError?.("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
    callbacksOrOptions.onListeningChange?.(false);
    return null;
  }

  const isOptionsObject = "lang" in callbacksOrOptions || "continuous" in callbacksOrOptions;
  const lang = (isOptionsObject ? (callbacksOrOptions as SpeechRecognitionOptions).lang : optionsArg?.lang) || currentLanguage || "en-US";
  const continuous = isOptionsObject
    ? (callbacksOrOptions as SpeechRecognitionOptions).continuous !== false
    : optionsArg?.continuous !== false;

  const onTranscript = callbacksOrOptions.onTranscript;
  const onListeningChange = callbacksOrOptions.onListeningChange || (() => {});
  const onError = callbacksOrOptions.onError || (() => {});

  let running = true;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognitionClass();

    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onstart = () => {
      onListeningChange(true);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      // ── Acoustic Echo Cancellation: Discard any mic input while AI is speaking
      if (isAIAudioPlaying()) {
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
        const detected = detectTextLanguage(final);
        currentLanguage = detected;
        onTranscript(final, true);
      } else if (interim) {
        onTranscript(interim, false);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      if (event.error !== "no-speech") {
        onError(event.error || "Microphone recognition error");
      }
      onListeningChange(false);
    };

    recognition.onend = () => {
      onListeningChange(false);
      // Auto restart if continuous was requested and not stopped manually
      if (running && continuous) {
        try {
          recognition.start();
        } catch {
          // ignore
        }
      }
    };

    recognition.start();

    return {
      stop: () => {
        running = false;
        try {
          recognition.stop();
        } catch {
          // ignore
        }
        onListeningChange(false);
      },
      isActive: () => running,
    };
  } catch (err) {
    console.error("[Voice] Speech recognition init failed:", err);
    onError("Please check microphone permissions.");
    onListeningChange(false);
    return null;
  }
}
