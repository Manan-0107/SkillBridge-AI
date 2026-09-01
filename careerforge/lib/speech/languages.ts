/**
 * lib/speech/languages.ts
 *
 * Centralized Multilingual Language Catalog & Helper Utilities
 * Maps ISO codes to Web Speech API, Azure Speech SDK, and Google Cloud Speech locales.
 */

import { SupportedLanguage } from "./types";

export const SUPPORTED_LANGUAGES: Record<string, SupportedLanguage> = {
  en: {
    code: "en",
    name: "English",
    nativeName: "English",
    flag: "🌐",
    speechRecognitionLocale: "en-US",
    speechSynthesisLocale: "en-US",
    azureLocale: "en-US",
    googleLocale: "en-US",
    azureVoiceName: "en-US-JennyNeural",
    googleVoiceName: "en-US-Journey-F",
  },
  "en-IN": {
    code: "en-IN",
    name: "English (India)",
    nativeName: "English (India)",
    flag: "🇮🇳",
    speechRecognitionLocale: "en-IN",
    speechSynthesisLocale: "en-IN",
    azureLocale: "en-IN",
    googleLocale: "en-IN",
    azureVoiceName: "en-IN-NeerjaNeural",
    googleVoiceName: "en-IN-Standard-A",
  },
  hi: {
    code: "hi",
    name: "Hindi",
    nativeName: "हिन्दी",
    flag: "🇮🇳",
    speechRecognitionLocale: "hi-IN",
    speechSynthesisLocale: "hi-IN",
    azureLocale: "hi-IN",
    googleLocale: "hi-IN",
    azureVoiceName: "hi-IN-SwaraNeural",
    googleVoiceName: "hi-IN-Standard-A",
  },
  gu: {
    code: "gu",
    name: "Gujarati",
    nativeName: "ગુજરાતી",
    flag: "🇮🇳",
    speechRecognitionLocale: "gu-IN",
    speechSynthesisLocale: "gu-IN",
    azureLocale: "gu-IN",
    googleLocale: "gu-IN",
    azureVoiceName: "gu-IN-DhwaniNeural",
    googleVoiceName: "gu-IN-Standard-A",
  },
  fr: {
    code: "fr",
    name: "French",
    nativeName: "Français",
    flag: "🇫🇷",
    speechRecognitionLocale: "fr-FR",
    speechSynthesisLocale: "fr-FR",
    azureLocale: "fr-FR",
    googleLocale: "fr-FR",
    azureVoiceName: "fr-FR-DeniseNeural",
    googleVoiceName: "fr-FR-Journey-F",
  },
  es: {
    code: "es",
    name: "Spanish",
    nativeName: "Español",
    flag: "🇪🇸",
    speechRecognitionLocale: "es-ES",
    speechSynthesisLocale: "es-ES",
    azureLocale: "es-ES",
    googleLocale: "es-ES",
    azureVoiceName: "es-ES-ElviraNeural",
    googleVoiceName: "es-ES-Journey-F",
  },
  de: {
    code: "de",
    name: "German",
    nativeName: "Deutsch",
    flag: "🇩🇪",
    speechRecognitionLocale: "de-DE",
    speechSynthesisLocale: "de-DE",
    azureLocale: "de-DE",
    googleLocale: "de-DE",
    azureVoiceName: "de-DE-KatjaNeural",
    googleVoiceName: "de-DE-Journey-F",
  },
  mr: {
    code: "mr",
    name: "Marathi",
    nativeName: "मराठी",
    flag: "🇮🇳",
    speechRecognitionLocale: "mr-IN",
    speechSynthesisLocale: "mr-IN",
    azureLocale: "mr-IN",
    googleLocale: "mr-IN",
    azureVoiceName: "mr-IN-AarohiNeural",
    googleVoiceName: "mr-IN-Standard-A",
  },
  ta: {
    code: "ta",
    name: "Tamil",
    nativeName: "தமிழ்",
    flag: "🇮🇳",
    speechRecognitionLocale: "ta-IN",
    speechSynthesisLocale: "ta-IN",
    azureLocale: "ta-IN",
    googleLocale: "ta-IN",
    azureVoiceName: "ta-IN-PallaviNeural",
    googleVoiceName: "ta-IN-Standard-A",
  },
  te: {
    code: "te",
    name: "Telugu",
    nativeName: "తెలుగు",
    flag: "🇮🇳",
    speechRecognitionLocale: "te-IN",
    speechSynthesisLocale: "te-IN",
    azureLocale: "te-IN",
    googleLocale: "te-IN",
    azureVoiceName: "te-IN-ShrutiNeural",
    googleVoiceName: "te-IN-Standard-A",
  },
  bn: {
    code: "bn",
    name: "Bengali",
    nativeName: "বাংলা",
    flag: "🇮🇳",
    speechRecognitionLocale: "bn-IN",
    speechSynthesisLocale: "bn-IN",
    azureLocale: "bn-IN",
    googleLocale: "bn-IN",
    azureVoiceName: "bn-IN-TanishaaNeural",
    googleVoiceName: "bn-IN-Standard-A",
  },
  ja: {
    code: "ja",
    name: "Japanese",
    nativeName: "日本語",
    flag: "🇯🇵",
    speechRecognitionLocale: "ja-JP",
    speechSynthesisLocale: "ja-JP",
    azureLocale: "ja-JP",
    googleLocale: "ja-JP",
    azureVoiceName: "ja-JP-NanamiNeural",
    googleVoiceName: "ja-JP-Standard-A",
  },
  zh: {
    code: "zh",
    name: "Mandarin Chinese",
    nativeName: "简体中文",
    flag: "🇨🇳",
    speechRecognitionLocale: "zh-CN",
    speechSynthesisLocale: "zh-CN",
    azureLocale: "zh-CN",
    googleLocale: "zh-CN",
    azureVoiceName: "zh-CN-XiaoxiaoNeural",
    googleVoiceName: "cmn-CN-Standard-A",
  },
  ar: {
    code: "ar",
    name: "Arabic",
    nativeName: "العربية",
    flag: "🇸🇦",
    speechRecognitionLocale: "ar-SA",
    speechSynthesisLocale: "ar-SA",
    azureLocale: "ar-SA",
    googleLocale: "ar-SA",
    azureVoiceName: "ar-SA-ZariyahNeural",
    googleVoiceName: "ar-XA-Standard-A",
  },
  pt: {
    code: "pt",
    name: "Portuguese",
    nativeName: "Português",
    flag: "🇧🇷",
    speechRecognitionLocale: "pt-BR",
    speechSynthesisLocale: "pt-BR",
    azureLocale: "pt-BR",
    googleLocale: "pt-BR",
    azureVoiceName: "pt-BR-FranciscaNeural",
    googleVoiceName: "pt-BR-Standard-A",
  },
};

export const LANGUAGE_LIST = Object.values(SUPPORTED_LANGUAGES);

/**
 * Normalizes any language string/locale (e.g. "hi-IN", "hindi", "fr", "fr-FR")
 * to its standard base code or supported language object.
 */
export function getSupportedLanguage(codeOrLocale: string): SupportedLanguage {
  if (!codeOrLocale) return SUPPORTED_LANGUAGES["en"];
  const lower = codeOrLocale.toLowerCase().trim();

  if (SUPPORTED_LANGUAGES[lower]) return SUPPORTED_LANGUAGES[lower];

  const prefix = lower.split("-")[0];
  if (SUPPORTED_LANGUAGES[prefix]) return SUPPORTED_LANGUAGES[prefix];

  const match = LANGUAGE_LIST.find(
    (l) =>
      l.code.toLowerCase() === lower ||
      l.speechRecognitionLocale.toLowerCase() === lower ||
      l.azureLocale.toLowerCase() === lower ||
      l.googleLocale.toLowerCase() === lower ||
      l.name.toLowerCase() === lower ||
      l.nativeName.toLowerCase() === lower
  );

  return match || SUPPORTED_LANGUAGES["en"];
}

/**
 * High-precision multilingual text language detector:
 * Inspects Unicode script blocks, common keywords, and romanized transliterations.
 */
export function detectLanguageFromText(text: string): string {
  if (!text) return "en";
  const clean = text.trim();
  const lower = clean.toLowerCase();

  // 1. Script-based Unicode checks (100% confidence)
  if (/[\u0A80-\u0AFF]/.test(clean)) return "gu"; // Gujarati
  if (/[\u0900-\u097F]/.test(clean)) {
    if (/\b(कसे|माझे|नाव|मदत|करा|आहे|नाही)\b/.test(clean)) return "mr"; // Marathi
    return "hi"; // Hindi
  }
  if (/[\u0B80-\u0BFF]/.test(clean)) return "ta"; // Tamil
  if (/[\u0C00-\u0C7F]/.test(clean)) return "te"; // Telugu
  if (/[\u0980-\u09FF]/.test(clean)) return "bn"; // Bengali
  if (/[\u0600-\u06FF]/.test(clean)) return "ar"; // Arabic
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(clean)) return "ja"; // Japanese
  if (/[\u4E00-\u9FFF]/.test(clean)) return "zh"; // Chinese

  // 2. Transliterated / Spoken keywords
  // Gujarati Transliteration (Gujlish)
  if (
    /\b(kem cho|maru naam|tamaru naam|mane madad|shu karvu|shu chhe|sikhavo|shikho|shikhvu|kevi rite|karvi|aabhar|joiye|nathi|chhu|chhe|avjo|saras|khub|banavva|madad karo)\b/i.test(
      lower
    )
  ) {
    return "gu";
  }

  // Hindi Transliteration (Hinglish)
  if (
    /\b(kaise ho|namaste|mera naam|aapka naam|madad chahiye|kya karu|kya karna|batao|kripya|dhanyawad|shukriya|accha|theek|bhai|sahayata|naukri)\b/i.test(
      lower
    )
  ) {
    return "hi";
  }

  // French
  if (
    /[éèêëàâîïôûùç]/i.test(clean) ||
    /\b(bonjour|salut|comment|je cherche|emploi|travail|developpeur|aide|merci|s'il vous plait|mon nom|oui|non|cv|projet)\b/i.test(
      lower
    )
  ) {
    return "fr";
  }

  // Spanish
  if (
    /[ñáéíóú¿¡]/i.test(clean) ||
    /\b(hola|como estas|ayuda|gracias|por favor|mi nombre|buenos dias|buenas tardes|trabajo|empleo|busco|quiero|curriculum)\b/i.test(
      lower
    )
  ) {
    return "es";
  }

  // German
  if (
    /[äöüß]/i.test(clean) ||
    /\b(hallo|hilfe|danke|bitte|mein name|guten tag|arbeit|lebenslauf|stelle)\b/i.test(lower)
  ) {
    return "de";
  }

  // Portuguese
  if (
    /[ãõçáéíóú]/i.test(clean) ||
    /\b(ola|bom dia|boa tarde|obrigado|ajuda|por favor|meu nome|trabalho|emprego|vaga)\b/i.test(lower)
  ) {
    return "pt";
  }

  return "en";
}

/**
 * Returns candidate language codes formatted for multi-language recognition
 */
export function getCandidateLanguageLocales(
  primaryLang = "en",
  provider: "azure" | "google" | "web" = "azure"
): string[] {
  const primary = getSupportedLanguage(primaryLang);
  const candidates = [
    primary,
    SUPPORTED_LANGUAGES["en"],
    SUPPORTED_LANGUAGES["hi"],
    SUPPORTED_LANGUAGES["gu"],
    SUPPORTED_LANGUAGES["fr"],
    SUPPORTED_LANGUAGES["es"],
  ];

  const unique = Array.from(new Set(candidates));
  if (provider === "azure") {
    return unique.map((l) => l.azureLocale);
  }
  if (provider === "google") {
    return unique.map((l) => l.googleLocale);
  }
  return unique.map((l) => l.speechRecognitionLocale);
}
