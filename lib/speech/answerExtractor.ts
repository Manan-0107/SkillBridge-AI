/**
 * lib/speech/answerExtractor.ts
 *
 * Question-Aware Multilingual Speech Answer Extractor:
 * Converts raw conversational speech transcripts into clean, extracted answers
 * to populate the existing input box before validation and submission.
 *
 * Example:
 * Raw: "My name is Manan Shah." -> Extracted: "Manan Shah"
 * Raw: "My email is manan@example.com" -> Extracted: "manan@example.com"
 * Raw: "I live in Surat, Gujarat." -> Extracted: "Surat, Gujarat"
 * Raw: "Yes, I already have one." -> Extracted: "Yes"
 * Raw: "Je m'appelle Manan Shah." -> Extracted: "Manan Shah"
 * Raw: "मेरा नाम मनन शाह है।" -> Extracted: "मनन शाह"
 * Raw: "મારું નામ મનન શાહ છે." -> Extracted: "મનન શાહ"
 */

import { AnswerType, SpeechAnswer } from "./types";
import { normalizeSpokenEmail } from "../voice";

/**
 * 1. Name Extractor
 * Extracts clean person names from conversational patterns in all supported languages
 */
export function extractName(raw: string, lang = "en"): string {
  if (!raw || !raw.trim()) return "";
  let clean = raw.trim();

  // English Patterns
  clean = clean.replace(/^(?:hello|hi|hey|good\s+morning|good\s+afternoon|good\s+evening)[,\s]+/i, "");
  clean = clean.replace(/^(?:my\s+full\s+name\s+is|my\s+name\s+is|my\s+name's|i'm\s+called|you\s+can\s+call\s+me|this\s+is|it's|i'm|i\s+am)\s+/i, "");
  clean = clean.replace(/\s+(?:is\s+my\s+name|here)$/i, "");

  // French Patterns
  clean = clean.replace(/^(?:bonjour|salut)[,\s]+/i, "");
  clean = clean.replace(/^(?:je\s+m'appelle|mon\s+nom\s+est|mon\s+prénom\s+est|moi\s+c'est|on\s+m'appelle|je\s+suis)\s+/i, "");

  // Hindi Patterns (Devanagari & Romanized)
  clean = clean.replace(/^(?:नमस्ते|नमस्कार|हेलो|हाय)[,\s]+/i, "");
  clean = clean.replace(/^(?:मेरा\s+नाम|मेरा\s+पूरा\s+नाम|मुझे|मैं)\s+/i, "");
  clean = clean.replace(/\s+(?:नाम\s+है|कहते\s+हैं|हूँ|है)$/i, "");
  clean = clean.replace(/^(?:mera\s+naam|mera\s+pura\s+naam|mujhe|main)\s+/i, "");
  clean = clean.replace(/\s+(?:naam\s+hai|kehte\s+hain|hoon|hai)$/i, "");

  // Gujarati Patterns (Gujarati script & Romanized)
  clean = clean.replace(/^(?:નમસ્તે|નમસ્કાર|હેલો|હાય)[,\s]+/i, "");
  clean = clean.replace(/^(?:મારું\s+નામ|મારું\s+પૂરું\s+નામ|મને|હું)\s+/i, "");
  clean = clean.replace(/\s+(?:નામ\s+છે|કહે\s+છે|છું|છે)$/i, "");
  clean = clean.replace(/^(?:maru\s+naam|maru\s+puru\s+naam|mane|hoon|hu)\s+/i, "");
  clean = clean.replace(/\s+(?:naam\s+chhe|kahe\s+chhe|chhu|chhe)$/i, "");

  // Spanish & German Patterns
  clean = clean.replace(/^(?:hola|buenos\s+días)[,\s]+/i, "");
  clean = clean.replace(/^(?:me\s+llamo|mi\s+nombre\s+es|soy)\s+/i, "");
  clean = clean.replace(/^(?:hallo|guten\s+tag)[,\s]+/i, "");
  clean = clean.replace(/^(?:ich\s+heiße|ich\s+heisse|mein\s+name\s+ist|ich\s+bin)\s+/i, "");

  // Clean trailing punctuation
  clean = clean.replace(/[.,;?!]+$/, "").trim();

  // If text is in Latin characters, format to Title Case
  if (/^[a-zA-Z\s'-]+$/.test(clean)) {
    clean = clean
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }

  return clean || raw.trim();
}

/**
 * 2. Email Extractor
 * Extracts and normalizes valid email addresses from conversational sentences
 */
export function extractEmail(raw: string): string {
  if (!raw || !raw.trim()) return "";
  const normalized = normalizeSpokenEmail(raw.trim());

  // Search for an email pattern
  const emailMatch = normalized.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (emailMatch) {
    return emailMatch[1].toLowerCase();
  }

  // Fallback: strip conversational phrases
  let clean = normalized;
  clean = clean.replace(/^(?:my\s+email\s+is|my\s+email\s+address\s+is|email\s+is|it's|you\s+can\s+email\s+me\s+at)\s*/i, "");
  clean = clean.replace(/^(?:mon\s+email\s+est|mon\s+adresse\s+email\s+est)\s*/i, "");
  clean = clean.replace(/^(?:मेरा\s+ईमेल|मेरा\s+ईमेल\s+आईडी)\s*/i, "");
  clean = clean.replace(/^(?:મારો\s+ઈમેલ)\s*/i, "");
  clean = clean.replace(/[.,;?!]+$/, "").trim();

  return clean.toLowerCase();
}

/**
 * 3. Phone Number Extractor
 * Extracts phone numbers from conversational sentences
 */
export function extractPhone(raw: string): string {
  if (!raw || !raw.trim()) return "";
  let clean = raw.trim();

  // Extract continuous digits with optional country code (+91, 1, etc.)
  const match = clean.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\d{10,12}/);
  if (match) {
    return match[0].replace(/[\s().-]/g, "");
  }

  // Strip prefix
  clean = clean.replace(/^(?:my\s+phone\s+number\s+is|my\s+number\s+is|my\s+contact\s+is|call\s+me\s+at|reach\s+me\s+at)\s*/i, "");
  clean = clean.replace(/^(?:mon\s+numéro\s+est|mon\s+téléphone\s+est)\s*/i, "");
  clean = clean.replace(/^(?:मेरा\s+फ़ोन\s+नंबर|मेरा\s+नंबर)\s*/i, "");
  clean = clean.replace(/^(?:મારો\s+ફોન\s+નંબર|મારો\s+નંબર)\s*/i, "");
  clean = clean.replace(/[.,;?!]+$/, "").trim();

  return clean;
}

/**
 * 4. Location Extractor
 * Extracts city, state, or country from conversational phrases
 */
export function extractLocation(raw: string): string {
  if (!raw || !raw.trim()) return "";
  let clean = raw.trim();

  // English
  clean = clean.replace(/^(?:i\s+live\s+in|i'm\s+living\s+in|i\s+am\s+located\s+in|i'm\s+located\s+in|i\s+am\s+based\s+in|i'm\s+based\s+in|i\s+reside\s+in|i'm\s+from|from|based\s+in|living\s+in|located\s+in)\s+/i, "");

  // French
  clean = clean.replace(/^(?:j'habite\s+à|j'habite\s+en|j'habite\s+au|je\s+vis\s+à|je\s+suis\s+basé\s+à|je\s+suis\s+de)\s+/i, "");

  // Hindi
  clean = clean.replace(/^(?:मैं|मेरा\s+स्थान|मैं\s+रहता\s+हूँ)\s+/i, "");
  clean = clean.replace(/\s+(?:में\s+रहता\s+हूँ|से\s+हूँ|में\s+स्थित\s+हूँ)$/i, "");
  clean = clean.replace(/^(?:main|mera\s+sthan)\s+/i, "");
  clean = clean.replace(/\s+(?:mein\s+rehta\s+hoon|se\s+hoon)$/i, "");

  // Gujarati
  clean = clean.replace(/^(?:હું|મારું\s+સ્થળ|હું\s+રહું\s+છું)\s+/i, "");
  clean = clean.replace(/\s+(?:માં\s+રહું\s+છું|થી\s+છું|માં\s+છું)$/i, "");
  clean = clean.replace(/^(?:hu|hoon|maru\s+sthan)\s+/i, "");
  clean = clean.replace(/\s+(?:ma\s+rahu\s+chhu|thi\s+chhu)$/i, "");

  clean = clean.replace(/[.,;?!]+$/, "").trim();

  if (/^[a-zA-Z\s,.-]+$/.test(clean)) {
    clean = clean
      .split(/\s*,\s*/)
      .map((part) =>
        part
          .split(/\s+/)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(" ")
      )
      .join(", ");
  }

  return clean || raw.trim();
}

/**
 * 5. Job Role / Career Extractor
 * Extracts target career title from conversational phrases
 */
export function extractJobRole(raw: string): string {
  if (!raw || !raw.trim()) return "";
  let clean = raw.trim();

  // English
  clean = clean.replace(/^(?:i'm\s+looking\s+for\s+a(?:n)?|i\s+am\s+looking\s+for\s+a(?:n)?|i\s+want\s+to\s+be\s+a(?:n)?|i\s+want\s+a\s+job\s+as\s+a(?:n)?|i\s+want\s+a(?:n)?|i'm\s+interested\s+in\s+a(?:n)?|i\s+am\s+interested\s+in|looking\s+for\s+a(?:n)?|aspiring)\s+/i, "");
  clean = clean.replace(/\s+(?:job|position|role|opportunity|career)$/i, "");

  // French
  clean = clean.replace(/^(?:je\s+cherche\s+un\s+emploi\s+de|je\s+cherche\s+un\s+poste\s+de|je\s+veux\s+devenir|je\s+souhaite\s+être)\s+/i, "");

  // Hindi
  clean = clean.replace(/^(?:मुझे|मैं)\s+/i, "");
  clean = clean.replace(/\s+(?:की\s+नौकरी\s+चाहिए|का\s+काम\s+चाहिए|बनना\s+चाहता\s+हूँ|रोल\s+चाहिए)$/i, "");
  clean = clean.replace(/^(?:mujhe|main)\s+/i, "");
  clean = clean.replace(/\s+(?:ki\s+naukri\s+chahiye|banna\s+chahta\s+hoon)$/i, "");

  // Gujarati
  clean = clean.replace(/^(?:મને|હું)\s+/i, "");
  clean = clean.replace(/\s+(?:ની\s+જોબ\s+જોઈએ\s+છે|ની\s+નોકરી\s+જોઈએ\s+છે|બનવા\s+માંગું\s+છું)$/i, "");
  clean = clean.replace(/^(?:mane|hu)\s+/i, "");
  clean = clean.replace(/\s+(?:ni\s+job\s+joiye\s+chhe|banna\s+mangu\s+chhu)$/i, "");

  clean = clean.replace(/[.,;?!]+$/, "").trim();

  if (/^[a-zA-Z\s/-]+$/.test(clean)) {
    clean = clean
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }

  return clean || raw.trim();
}

/**
 * 6. Multilingual YES/NO Extractor
 * Extracts canonical localized YES or NO
 */
export function extractYesNo(raw: string, lang = "en"): { extracted: string; value: boolean | null } {
  if (!raw || !raw.trim()) return { extracted: "", value: null };

  const text = raw.trim();
  const lower = text.toLowerCase();

  // English Checks
  const isEngYes = /\b(yes|yeah|yep|yup|sure|of course|i do|i have one|already have|certainly|absolutely|affirmative|right)\b/i.test(lower);
  const isEngNo = /\b(no|nope|nah|not yet|i don't|dont|do not|no resume|dont have|i need one|create one)\b/i.test(lower);

  // French Checks
  const isFrYes = /\b(oui|ouais|d'accord|bien sûr|j'en ai un|j'ai un cv|absolument)\b/i.test(lower);
  const isFrNo = /\b(non|pas encore|je n'ai pas|pas de cv|aucun cv)\b/i.test(lower);

  // Hindi Checks
  const isHiYes = /[\u0900-\u097F]/.test(text)
    ? /\b(हाँ|हां|हाँ है|जी हाँ|अवश्य|बिल्कुल|सही|मेरे पास है)\b/.test(text)
    : /\b(haan|haa|ha|ji haan|bilkul|sahi|hai|mere paas hai)\b/i.test(lower);
  const isHiNo = /[\u0900-\u097F]/.test(text)
    ? /\b(नहीं|नही|नहीं है|ना|न|नहीं बनाया|मेरे पास नहीं है)\b/.test(text)
    : /\b(nahi|nahin|na|nhi|nahi hai|mere paas nahi hai)\b/i.test(lower);

  // Gujarati Checks
  const isGuYes = /[\u0A80-\u0AFF]/.test(text)
    ? /\b(હા|હા છે|ચોક્કસ|સાચું|બરાબર|મારી પાસે છે)\b/.test(text)
    : /\b(ha|haa|ha chhe|chhe|saras)\b/i.test(lower);
  const isGuNo = /[\u0A80-\u0AFF]/.test(text)
    ? /\b(ના|નથી|નહીં|ના નથી|મારી પાસે નથી)\b/.test(text)
    : /\b(na|nathi|nahi|na nathi)\b/i.test(lower);

  if (isEngYes || isFrYes || isHiYes || isGuYes) {
    if (lang.startsWith("fr")) return { extracted: "Oui", value: true };
    if (lang.startsWith("hi")) return { extracted: "हाँ", value: true };
    if (lang.startsWith("gu")) return { extracted: "હા", value: true };
    return { extracted: "Yes", value: true };
  }

  if (isEngNo || isFrNo || isHiNo || isGuNo) {
    if (lang.startsWith("fr")) return { extracted: "Non", value: false };
    if (lang.startsWith("hi")) return { extracted: "नहीं", value: false };
    if (lang.startsWith("gu")) return { extracted: "ના", value: false };
    return { extracted: "No", value: false };
  }

  return { extracted: raw.trim(), value: null };
}

/**
 * 7. Long Text / Open-Ended Extractor
 * Cleans conversational fillers without destroying the user's detailed meaning
 */
export function extractLongText(raw: string): string {
  if (!raw || !raw.trim()) return "";
  let clean = raw.trim();

  // Strip leading filler words
  clean = clean.replace(/^(?:well|actually|um|uh|you know|so|basically|like|honestly)[,\s]+/i, "");
  clean = clean.replace(/^(?:eh bien|en fait|euh|alors)[,\s]+/i, "");
  clean = clean.replace(/^(?:अच्छा|वैसे|तो)[,\s]+/i, "");
  clean = clean.replace(/^(?:સારું|ખરેખર|તો)[,\s]+/i, "");

  return clean.trim();
}

/**
 * Universal Master Answer Extractor
 * Dispatches to the appropriate typed extractor based on question context
 */
export function extractAnswerFromTranscript(
  rawTranscript: string,
  answerType: AnswerType = "free_text",
  lang = "en"
): SpeechAnswer {
  if (!rawTranscript || !rawTranscript.trim()) {
    return {
      rawTranscript: "",
      extractedAnswer: "",
      answerType,
      isValid: false,
    };
  }

  const raw = rawTranscript.trim();
  let extracted = raw;
  let isValid = true;

  switch (answerType) {
    case "name": {
      extracted = extractName(raw, lang);
      isValid = extracted.length >= 2;
      break;
    }
    case "email": {
      extracted = extractEmail(raw);
      isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(extracted);
      break;
    }
    case "phone": {
      extracted = extractPhone(raw);
      isValid = /^\+?[\d\s-]{7,15}$/.test(extracted);
      break;
    }
    case "location": {
      extracted = extractLocation(raw);
      isValid = extracted.length >= 2;
      break;
    }
    case "job_role": {
      extracted = extractJobRole(raw);
      isValid = extracted.length >= 2;
      break;
    }
    case "yes_no": {
      const res = extractYesNo(raw, lang);
      extracted = res.extracted;
      isValid = res.value !== null;
      break;
    }
    case "number": {
      const digits = raw.replace(/[^0-9]/g, "");
      extracted = digits || raw;
      isValid = digits.length > 0;
      break;
    }
    case "long_text": {
      extracted = extractLongText(raw);
      isValid = extracted.length >= 2;
      break;
    }
    case "short_text":
    case "choice":
    case "free_text":
    case "text":
    default: {
      extracted = extractLongText(raw);
      isValid = extracted.length >= 1;
      break;
    }
  }

  return {
    rawTranscript: raw,
    extractedAnswer: extracted,
    answerType,
    isValid,
  };
}
