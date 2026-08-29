/**
 * Universal Multilingual Voice Engine (100% Free & Unlimited)
 * Built on Browser Native Web Speech API (SpeechSynthesis & SpeechRecognition)
 * Supporting 20+ Global and Regional Languages (English, Hindi, Hinglish, Spanish, etc.)
 * with intelligent voice matching and silence detection hooks.
 */

// ─── Supported Languages List ────────────────────────────────────────────────
export interface VoiceLanguage {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: VoiceLanguage[] = [
  { code: "auto", name: "Auto Detect", nativeName: "Auto / Multi", flag: "🌐" },
  { code: "en-US", name: "English (US)", nativeName: "English (US)", flag: "🇺🇸" },
  { code: "en-IN", name: "English (India)", nativeName: "English (India)", flag: "🇮🇳" },
  { code: "hi-IN", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳" },
  { code: "es-ES", name: "Spanish", nativeName: "Español", flag: "🇪🇸" },
  { code: "fr-FR", name: "French", nativeName: "Français", flag: "🇫🇷" },
  { code: "de-DE", name: "German", nativeName: "Deutsch", flag: "🇩🇪" },
  { code: "te-IN", name: "Telugu", nativeName: "తెలుగు", flag: "🇮🇳" },
  { code: "ta-IN", name: "Tamil", nativeName: "தமிழ்", flag: "🇮🇳" },
  { code: "mr-IN", name: "Marathi", nativeName: "मराठी", flag: "🇮🇳" },
  { code: "bn-IN", name: "Bengali", nativeName: "বাংলা", flag: "🇮🇳" },
  { code: "gu-IN", name: "Gujarati", nativeName: "ગુજરાતી", flag: "🇮🇳" },
  { code: "kn-IN", name: "Kannada", nativeName: "ಕನ್ನಡ", flag: "🇮🇳" },
  { code: "ml-IN", name: "Malayalam", nativeName: "മലയാളം", flag: "🇮🇳" },
  { code: "pa-IN", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ", flag: "🇮🇳" },
  { code: "ar-SA", name: "Arabic", nativeName: "العربية", flag: "🇸🇦" },
  { code: "ja-JP", name: "Japanese", nativeName: "日本語", flag: "🇯🇵" },
  { code: "zh-CN", name: "Chinese (Mandarin)", nativeName: "中文", flag: "🇨🇳" },
  { code: "pt-BR", name: "Portuguese", nativeName: "Português", flag: "🇧🇷" },
  { code: "ru-RU", name: "Russian", nativeName: "Русский", flag: "🇷🇺" },
];

// Helper to detect language script from text
export function detectLanguageFromText(text: string): string {
  if (!text) return "en-US";
  if (/[\u0900-\u097F]/.test(text)) return "hi-IN"; // Devanagari (Hindi, Marathi)
  if (/[\u0C00-\u0C7F]/.test(text)) return "te-IN"; // Telugu
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta-IN"; // Tamil
  if (/[\u0980-\u09FF]/.test(text)) return "bn-IN"; // Bengali
  if (/[\u0A80-\u0AFF]/.test(text)) return "gu-IN"; // Gujarati
  if (/[\u0C80-\u0CFF]/.test(text)) return "kn-IN"; // Kannada
  if (/[\u0D00-\u0D7F]/.test(text)) return "ml-IN"; // Malayalam
  if (/[\u0600-\u06FF]/.test(text)) return "ar-SA"; // Arabic
  if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text)) return "ja-JP"; // Japanese/Chinese
  if (/[áéíóúüñ¿¡]/i.test(text)) return "es-ES"; // Spanish
  if (/[àâçéèêëîïôûùüÿœæ]/i.test(text)) return "fr-FR"; // French
  if (/[äöüß]/i.test(text)) return "de-DE"; // German
  return "en-US";
}

// ─── 1. Multilingual Text-to-Speech (SpeechSynthesis) ─────────────────────────

let activeUtterance: SpeechSynthesisUtterance | null = null;

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function stopSpeaking() {
  if (isSpeechSynthesisSupported()) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
    activeUtterance = null;
  }
}

export function isSpeaking(): boolean {
  if (!isSpeechSynthesisSupported()) return false;
  return window.speechSynthesis.speaking;
}

export function speakText(
  text: string,
  callbacks?: {
    lang?: string;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: unknown) => void;
  }
) {
  if (!isSpeechSynthesisSupported()) {
    callbacks?.onError?.("SpeechSynthesis not supported on this device.");
    return;
  }

  // Cancel any ongoing speech first
  stopSpeaking();

  // Clean Markdown & Action Tags from text for pleasant natural audio
  const cleanText = text
    .replace(/\[ACTION:.*?\]/g, "")
    .replace(/```[\s\S]*?```/g, "Code block omitted.")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/#+\s/g, "")
    .replace(/>\s/g, "")
    .replace(/[•\-\*]\s/g, "")
    .trim();

  if (!cleanText) {
    callbacks?.onEnd?.();
    return;
  }

  const utterance = new SpeechSynthesisUtterance(cleanText);
  activeUtterance = utterance;

  // Auto detect or use provided language
  const detectedLang = callbacks?.lang && callbacks.lang !== "auto"
    ? callbacks.lang
    : detectLanguageFromText(cleanText);

  utterance.lang = detectedLang;
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  // Select best matching voice from available synthesis voices
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    const langPrefix = detectedLang.split("-")[0].toLowerCase();
    const matchingVoice =
      voices.find((v) => v.lang.toLowerCase() === detectedLang.toLowerCase()) ||
      voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix)) ||
      voices.find(
        (v) =>
          v.lang.startsWith("en") &&
          (v.name.includes("Google") ||
            v.name.includes("Natural") ||
            v.name.includes("Samantha") ||
            v.name.includes("Daniel") ||
            v.name.includes("Microsoft"))
      ) ||
      voices[0];

    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }
  }

  utterance.onstart = () => {
    callbacks?.onStart?.();
  };

  utterance.onend = () => {
    activeUtterance = null;
    callbacks?.onEnd?.();
  };

  utterance.onerror = (e) => {
    activeUtterance = null;
    callbacks?.onError?.(e);
  };

  window.speechSynthesis.speak(utterance);
}

// ─── 2. Multilingual Speech-to-Text (SpeechRecognition) ──────────────────────

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
}

export type SpeechRecognitionController = {
  stop: () => void;
  lang: string;
};

export function startSpeechRecognition(
  callbacks: {
    lang?: string;
    onTranscript: (text: string, isFinal: boolean) => void;
    onListeningChange: (listening: boolean) => void;
    onError: (error: string) => void;
  }
): SpeechRecognitionController | null {
  if (!isSpeechRecognitionSupported()) {
    callbacks.onError("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.");
    callbacks.onListeningChange(false);
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognitionClass();

    const selectedLang = callbacks.lang && callbacks.lang !== "auto"
      ? callbacks.lang
      : (typeof navigator !== "undefined" && navigator.language ? navigator.language : "en-US");

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = selectedLang;
    recognition.maxAlternatives = 3;

    let manuallyStopped = false;

    recognition.onstart = () => {
      callbacks.onListeningChange(true);
    };

    let sessionFinalTranscript = "";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcriptPart = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) {
          sessionFinalTranscript = (sessionFinalTranscript ? `${sessionFinalTranscript} ` : "") + transcriptPart.trim();
        } else {
          interimTranscript += transcriptPart;
        }
      }

      const combinedSessionTranscript = (
        sessionFinalTranscript + (interimTranscript ? ` ${interimTranscript}` : "")
      ).trim();

      if (combinedSessionTranscript) {
        callbacks.onTranscript(combinedSessionTranscript, interimTranscript.length === 0);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      if (event.error === "no-speech" || event.error === "aborted") {
        // Normal silence or graceful abort
        return;
      }
      console.warn("[Voice] Speech recognition error:", event.error);
      callbacks.onError(event.error === "not-allowed" ? "Microphone permission denied" : (event.error || "Recognition error"));
      callbacks.onListeningChange(false);
    };

    recognition.onend = () => {
      if (!manuallyStopped) {
        callbacks.onListeningChange(false);
      }
    };

    recognition.start();

    return {
      stop: () => {
        manuallyStopped = true;
        try {
          recognition.stop();
        } catch {
          // ignore
        }
        callbacks.onListeningChange(false);
      },
      lang: selectedLang,
    };
  } catch (err) {
    console.error("[Voice] Failed to initialize speech recognition:", err);
    callbacks.onError("Failed to start microphone. Please check permissions.");
    callbacks.onListeningChange(false);
    return null;
  }
}
