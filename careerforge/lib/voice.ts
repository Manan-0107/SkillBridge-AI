/**
 * Universal Multi-Language Voice & Accessibility Engine (100% Free & Unlimited)
 * - Multi-Language Speech Recognition (STT): All Indian, European, Asian & Global languages
 * - Automatic Language-Matching Speech Synthesis (TTS): Detects language & speaks with matching native voice
 * - Step-by-Step AI Accessibility Audio Assistance for Disabled Users
 */

export interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: "en-US", name: "English (US)", nativeName: "English", flag: "🇺🇸" },
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
let currentLanguage = "en-IN";

// ─── 1. Automatic Language Detection from Text ─────────────────────────────────
export function detectTextLanguage(text: string): string {
  if (!text) return currentLanguage || "en-IN";

  // Gujarati
  if (/[\u0A80-\u0AFF]/.test(text)) return "gu-IN";
  // Hindi / Marathi / Sanskrit (Devanagari)
  if (/[\u0900-\u097F]/.test(text)) return "hi-IN";
  // Tamil
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta-IN";
  // Telugu
  if (/[\u0C00-\u0C7F]/.test(text)) return "te-IN";
  // Bengali
  if (/[\u0980-\u09FF]/.test(text)) return "bn-IN";
  // Arabic
  if (/[\u0600-\u06FF]/.test(text)) return "ar-SA";
  // Japanese
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(text)) return "ja-JP";
  // Chinese
  if (/[\u4E00-\u9FFF]/.test(text)) return "zh-CN";
  // Spanish
  if (/[ñáéíóú¿¡]/i.test(text)) return "es-ES";
  // German
  if (/[äöüß]/i.test(text)) return "de-DE";
  // French
  if (/[éèêëàâîïôûùç]/i.test(text)) return "fr-FR";

  return currentLanguage || "en-US";
}

export function setGlobalVoiceLanguage(langCode: string) {
  currentLanguage = langCode;
}

export function getGlobalVoiceLanguage(): string {
  return currentLanguage || "en-IN";
}

// ─── 2. Multi-Language Text-to-Speech (TTS) ───────────────────────────────────

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function stopSpeaking() {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel();
    activeUtterance = null;
  }
}

export function isSpeaking(): boolean {
  if (!isSpeechSynthesisSupported()) return false;
  return window.speechSynthesis.speaking;
}

export function speakText(
  text: string,
  options?: {
    lang?: string;
    rate?: number;
    pitch?: number;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: unknown) => void;
  }
) {
  if (!isSpeechSynthesisSupported()) {
    options?.onError?.("SpeechSynthesis not supported on this device.");
    return;
  }

  // Cancel any active speech
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
    .trim();

  if (!cleanText) {
    options?.onEnd?.();
    return;
  }

  // Determine target language (explicit or auto-detected)
  const targetLang = options?.lang || detectTextLanguage(cleanText);

  const utterance = new SpeechSynthesisUtterance(cleanText);
  activeUtterance = utterance;

  utterance.lang = targetLang;
  utterance.rate = options?.rate || 0.95; // Slightly slower for maximum accessibility clarity
  utterance.pitch = options?.pitch || 1.0;
  utterance.volume = 1.0;

  // Find the highest quality voice matching the language
  const voices = window.speechSynthesis.getVoices();
  const langPrefix = targetLang.split("-")[0];

  const matchingVoice =
    voices.find((v) => v.lang.toLowerCase() === targetLang.toLowerCase()) ||
    voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix.toLowerCase())) ||
    voices.find((v) => v.name.includes("Google") || v.name.includes("Natural")) ||
    voices[0];

  if (matchingVoice) {
    utterance.voice = matchingVoice;
  }

  utterance.onstart = () => {
    options?.onStart?.();
  };

  utterance.onend = () => {
    activeUtterance = null;
    options?.onEnd?.();
  };

  utterance.onerror = (e) => {
    activeUtterance = null;
    options?.onError?.(e);
  };

  window.speechSynthesis.speak(utterance);
}

// ─── 3. Multi-Language Speech-to-Text (STT) ───────────────────────────────────

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
}

export type SpeechRecognitionController = {
  stop: () => void;
};

export function startSpeechRecognition(
  callbacks: {
    onTranscript: (text: string, isFinal: boolean) => void;
    onListeningChange: (listening: boolean) => void;
    onError: (error: string) => void;
  },
  options?: {
    lang?: string;
  }
): SpeechRecognitionController | null {
  if (!isSpeechRecognitionSupported()) {
    callbacks.onError("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
    callbacks.onListeningChange(false);
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognitionClass();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = options?.lang || currentLanguage || "en-IN";

    recognition.onstart = () => {
      callbacks.onListeningChange(true);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
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
        // Auto-update global language if non-English script is spoken
        const detected = detectTextLanguage(final);
        if (detected !== "en-IN") currentLanguage = detected;
        callbacks.onTranscript(final, true);
      } else if (interim) {
        callbacks.onTranscript(interim, false);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      if (event.error !== "no-speech") {
        callbacks.onError(event.error || "Microphone recognition error");
      }
      callbacks.onListeningChange(false);
    };

    recognition.onend = () => {
      callbacks.onListeningChange(false);
    };

    recognition.start();

    return {
      stop: () => {
        try {
          recognition.stop();
        } catch {
          // ignore
        }
        callbacks.onListeningChange(false);
      },
    };
  } catch (err) {
    console.error("[Voice] Speech recognition init failed:", err);
    callbacks.onError("Please check microphone permissions.");
    callbacks.onListeningChange(false);
    return null;
  }
}

// ─── 4. Step-by-Step AI Accessibility Co-Pilot Audio Guide ────────────────────
export function speakAccessibilityGuide(
  step: "overview" | "search" | "location" | "apply" | "alerts",
  lang = currentLanguage
) {
  const guideScripts: Record<string, Record<string, string>> = {
    "hi-IN": {
      overview: "नमस्ते! करियरफोर्ज में आपका स्वागत है। यहाँ आप अपने शहर में जॉब्स खोज सकते हैं, वॉयस से सुन सकते हैं, और सीधे रजिस्ट्रेशन फॉर्म पा सकते हैं। स्टेप एक: अपनी जॉब रोल बोलें या लिखें। स्टेप दो: अपने शहर की जॉब्स देखने के लिए लोकेशन बटन दबाएं।",
      search: "जॉब सर्च करने के लिए माइक बटन दबाएं और बोलें, या सर्च बॉक्स में लिखें।",
      location: "लोकेशन बटन पर क्लिक करें। यह आपके शहर या जिले की सभी नई ओपनिंग्स दिखाएगा।",
      apply: "अप्लाई करने के लिए अप्लाई नाउ बटन दबाएं, या ईमेल फॉर्म लिंक पर क्लिक करें।",
      alerts: "ईमेल अलर्ट्स एक्टिवेट करने के लिए अपना ईमेल डालें और सेट जॉब अलर्ट दबाएं।",
    },
    "gu-IN": {
      overview: "નમસ્તે! કરિયરફોર્જમાં આપનું સ્વાગત છે. અહીં તમે તમારા શહેરમાં જોબ શોધી શકો છો, અવાજથી સાંભળી શકો છો અને સીધું રજીસ્ટ્રેશન ફોર્મ મેળવી શકો છો.",
      search: "જોબ શોધવા માટે માઈક બટન દબાવો અને બોલો.",
      location: "તમારા શહેરની લાઈવ જોબ્સ જોવા માટે લોકેશન બટન પર ક્લિક કરો.",
      apply: "અરજી કરવા માટે એપ્લાય નાઉ બટન દબાવો અથવા ઇમેઇલ ફોર્મ પર ક્લિક કરો.",
      alerts: "નવી જોબ્સના એલર્ટ માટે ઇમેઇલ દાખલ કરો.",
    },
    "en-IN": {
      overview: "Welcome to CareerForge Accessibility Co-Pilot. Follow these easy steps: Step 1: Use the microphone to speak your role. Step 2: Click the Location Pin to track verified jobs in your city. Step 3: Click Listen to hear any job aloud, or click Email Form to receive the registration form directly.",
      search: "Click the voice button and speak any role or skill.",
      location: "Click the location pin to automatically find jobs in your exact city or district.",
      apply: "Click Apply Now to open the registration form, or Email Form to send it to your inbox.",
      alerts: "Enter your email to activate real-time opening alerts for your city.",
    },
  };

  const selectedLangDict = guideScripts[lang] || guideScripts["en-IN"];
  const scriptText = selectedLangDict[step] || selectedLangDict.overview;

  speakText(scriptText, { lang });
}
