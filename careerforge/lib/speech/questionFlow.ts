/**
 * lib/speech/questionFlow.ts
 *
 * Strict Turn-Taking Question Engine & Multilingual Answer Validation:
 * - 1 Question at a time enforcement
 * - Multilingual YES/NO classification (English, French, Hindi, Gujarati, Spanish, German, etc.)
 * - Type validation (yes_no, text, email, number, free_text)
 * - 3-Attempt Rule & Localized Retry Prompts
 * - Empathetic Text Fallback Messages
 */

import { ExpectedAnswerType, QuestionState } from "./types";
import { normalizeSpokenEmail } from "../voice";

export interface ValidationResult {
  valid: boolean;
  value?: any;
  reason?: "unrelated" | "invalid_format" | "empty" | "unrecognized";
}

/**
 * Multilingual YES/NO Classification
 */
export function validateYesNo(raw: string, lang = "en"): ValidationResult {
  if (!raw || !raw.trim()) {
    return { valid: false, reason: "empty" };
  }

  const text = raw.trim();
  const lower = text.toLowerCase();

  // ── English YES ──
  const isEnglishYes =
    /\b(yes|yeah|yep|yup|sure|of course|i do|i have one|i have a resume|i already have one|i got one|certainly|absolutely|affirmative|correct|right|ok|okay)\b/i.test(
      lower
    );

  // ── English NO ──
  const isEnglishNo =
    /\b(no|nope|nah|not yet|i don't|i dont|i do not|i don't have one|dont have one|no resume|dont have a resume|i need one|help me make one|create one)\b/i.test(
      lower
    );

  // ── French YES/NO ──
  const isFrenchYes = /\b(oui|ouais|d'accord|bien sûr|j'en ai un|j'ai un cv|absolument)\b/i.test(lower);
  const isFrenchNo = /\b(non|pas encore|je n'ai pas|pas de cv|aucun cv|pas de)\b/i.test(lower);

  // ── Hindi YES/NO ──
  const isHindiYes =
    /[\u0900-\u097F]/.test(text)
      ? /\b(हाँ|हां|हाँ है|हां है|जी हाँ|जी हां|अवश्य|बिल्कुल|सही|मेरे पास है)\b/.test(text)
      : /\b(haan|haa|ha|ji haan|ji ha|bilkul|sahi|hai|mere paas hai)\b/i.test(lower);

  const isHindiNo =
    /[\u0900-\u097F]/.test(text)
      ? /\b(नहीं|नही|नहीं है|ना|न|नहीं बनाया|मेरे पास नहीं है)\b/.test(text)
      : /\b(nahi|nahin|na|nhi|nahi hai|nhi hai|mere paas nahi hai)\b/i.test(lower);

  // ── Gujarati YES/NO ──
  const isGujaratiYes =
    /[\u0A80-\u0AFF]/.test(text)
      ? /\b(હા|હા છે|ચોક્કસ|સાચું|બરાબર|મારી પાસે છે)\b/.test(text)
      : /\b(ha|haa|ha chhe|chhe|saras|khub|maru chhe)\b/i.test(lower);

  const isGujaratiNo =
    /[\u0A80-\u0AFF]/.test(text)
      ? /\b(ના|નથી|નહીં|ના નથી|મારી પાસે નથી)\b/.test(text)
      : /\b(na|nathi|nahi|na nathi)\b/i.test(lower);

  // ── Spanish & German YES/NO ──
  const isSpanishYes = /\b(sí|si|claro|por supuesto|tengo uno|tengo cv)\b/i.test(lower);
  const isSpanishNo = /\b(no|todavía no|no tengo|ninguno)\b/i.test(lower);

  const isGermanYes = /\b(ja|klar|natürlich|ich habe einen)\b/i.test(lower);
  const isGermanNo = /\b(nein|noch nicht|kein cv|habe keinen)\b/i.test(lower);

  // Aggregate checks
  if (isEnglishYes || isFrenchYes || isHindiYes || isGujaratiYes || isSpanishYes || isGermanYes) {
    return { valid: true, value: true };
  }

  if (isEnglishNo || isFrenchNo || isHindiNo || isGujaratiNo || isSpanishNo || isGermanNo) {
    return { valid: true, value: false };
  }

  return { valid: false, reason: "unrelated" };
}

/**
 * Validate User's Name
 */
export function validateName(raw: string): ValidationResult {
  if (!raw || !raw.trim()) {
    return { valid: false, reason: "empty" };
  }

  let cleaned = raw.trim();
  // Strip conversational prefixes
  cleaned = cleaned
    .replace(/^(?:my name is|i am|call me|je m'appelle|maru naam|mera naam|mein name ist|me llamo)\s*/i, "")
    .replace(/[.,;?!]+$/, "")
    .trim();

  if (cleaned.length < 2) {
    return { valid: false, reason: "invalid_format" };
  }

  // Capitalize words
  const formatted = cleaned
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return { valid: true, value: formatted };
}

/**
 * Validate Email Address
 */
export function validateEmail(raw: string): ValidationResult {
  if (!raw || !raw.trim()) {
    return { valid: false, reason: "empty" };
  }

  const normalized = normalizeSpokenEmail(raw.trim());
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (emailRegex.test(normalized)) {
    return { valid: true, value: normalized };
  }

  return { valid: false, reason: "invalid_format" };
}

/**
 * Validate Career / Role / Free-text
 */
export function validateFreeText(raw: string): ValidationResult {
  if (!raw || !raw.trim()) {
    return { valid: false, reason: "empty" };
  }

  const cleaned = raw
    .trim()
    .replace(/^(?:i want to be a|i am interested in|i'm looking for a|i want a job in)\s*/i, "")
    .replace(/[.,;?!]+$/, "")
    .trim();

  if (cleaned.length < 2) {
    return { valid: false, reason: "invalid_format" };
  }

  return { valid: true, value: cleaned };
}

/**
 * Universal Answer Validator Dispatcher
 */
export function validateUserAnswer(
  rawInput: string,
  expectedType: ExpectedAnswerType,
  language = "en"
): ValidationResult {
  switch (expectedType) {
    case "yes_no":
      return validateYesNo(rawInput, language);
    case "email":
      return validateEmail(rawInput);
    case "number": {
      const num = parseInt(rawInput.replace(/[^0-9]/g, ""), 10);
      return !isNaN(num) ? { valid: true, value: num } : { valid: false, reason: "invalid_format" };
    }
    case "text":
    case "free_text":
    case "choice":
    default:
      return validateFreeText(rawInput);
  }
}

/**
 * Generates Question Retry Prompts based on Attempt Count
 */
export function getQuestionRetryPrompt(
  question: QuestionState,
  language = "en"
): string {
  const isGu = language.startsWith("gu");
  const isHi = language.startsWith("hi");
  const isFr = language.startsWith("fr");
  const isEs = language.startsWith("es");

  const attempt = question.attempts;

  if (question.expectedType === "yes_no") {
    if (attempt === 1) {
      if (isFr) return `D'accord, je comprends. Pour commencer, avez-vous déjà un CV — oui ou non ?`;
      if (isGu) return `કોઈ વાંધો નહીં, હું સમજી ગયો. સૌથી પહેલા, શું તમારી પાસે પહેલેથી જ રેઝ્યૂમે છે — હા કે ના?`;
      if (isHi) return `कोई बात नहीं, मैं समझ गया। सबसे पहले, क्या आपके पास पहले से कोई रेज़्यूमे है — हाँ या नहीं?`;
      if (isEs) return `Entendido. Primero, ¿ya tienes un currículum — sí o no?`;
      return `No problem. I'll get to that next. First, do you already have a resume — yes or no?`;
    }

    if (attempt >= 2) {
      if (isFr) return `Pas de souci. Un dernier essai : avez-vous déjà un CV ?`;
      if (isGu) return `કોઈ ચિંતા નથી. એક છેલ્લો પ્રયાસ: શું તમારી પાસે પહેલેથી જ રેઝ્યૂમે છે?`;
      if (isHi) return `कोई समस्या नहीं। एक आखिरी प्रयास: क्या आपके पास पहले से कोई रेज़्यूमे है?`;
      if (isEs) return `Sin problema. Un intento más: ¿ya tienes un currículum?`;
      return `No worries. One more try: do you already have a resume?`;
    }
  }

  // General questions
  if (attempt === 1) {
    if (isFr) return `Je n'ai pas bien compris. ${question.question}`;
    if (isGu) return `હું બરાબર સાંભળી શક્યો નહીં. ${question.question}`;
    if (isHi) return `मुझे ठीक से समझ नहीं आया। ${question.question}`;
    if (isEs) return `No logré entender bien. ${question.question}`;
    return `That's okay. I didn't quite catch that. ${question.question}`;
  }

  if (isFr) return `Pas de souci. Réessayons : ${question.question}`;
  if (isGu) return `કોઈ વાંધો નહીં. ચાલો ફરીથી પ્રયાસ કરીએ: ${question.question}`;
  if (isHi) return `कोई चिंता नहीं। आइए फिर से कोशिश करते हैं: ${question.question}`;
  if (isEs) return `No hay problema. Intentemos de nuevo: ${question.question}`;
  return `No worries. Let's try once more: ${question.question}`;
}

/**
 * Localized Empathetic 3-Attempt Text Fallback Message
 */
export function getFallbackMessage(language = "en"): string {
  const isGu = language.startsWith("gu");
  const isHi = language.startsWith("hi");
  const isFr = language.startsWith("fr");
  const isEs = language.startsWith("es");
  const isDe = language.startsWith("de");

  if (isFr) {
    return "Je ne veux pas rendre les choses difficiles. Continuons par écrit. Vous pouvez taper votre réponse ci-dessous.";
  }
  if (isGu) {
    return "હું આને તમારા માટે મુશ્કેલ બનાવવા માંગતો નથી. ચાલો લખાણ દ્વારા આગળ વધીએ. તમે નીચે તમારો જવાબ ટાઈપ કરી શકો છો.";
  }
  if (isHi) {
    return "मैं इसे आपके लिए मुश्किल नहीं बनाना चाहता। चलिए टेक्स्ट के माध्यम से आगे बढ़ते हैं। आप नीचे अपना उत्तर टाइप कर सकते हैं।";
  }
  if (isEs) {
    return "No quiero complicar las cosas. Continuemos por texto. Puedes escribir tu respuesta abajo.";
  }
  if (isDe) {
    return "Ich möchte es Ihnen nicht unnötig schwer machen. Lassen Sie uns per Text weitermachen. Sie können Ihre Antwort unten eingeben.";
  }

  return "I don't want to make this difficult for you. Let's continue using text. You can type your answer below.";
}
