/**
 * lib/conversationalResume.ts
 *
 * Conversational Step-by-Step Resume Builder Dialogue Manager:
 * - Guides users who don't have a resume through structured creation
 * - Asks ONE question at a time
 * - Supports natural controls: "go back", "change that", "skip this", "repeat", "continue"
 * - Requires confirmation for critical fields (e.g. Email / Phone)
 */

import { normalizeSpokenEmail } from "@/lib/voice";

export interface ResumeDraftState {
  step: number;
  fullName?: string;
  email?: string;
  emailConfirmed?: boolean;
  phone?: string;
  location?: string;
  targetRole?: string;
  education?: string;
  skills?: string[];
  experience?: string;
  projects?: string;
  certifications?: string;
  completed?: boolean;
}

export const RESUME_BUILDER_STEPS = [
  {
    step: 1,
    field: "fullName",
    title: "Full Name",
    question: "Let's build your resume together! First, what is your full name?",
    questionGu: "ચાલો સાથે મળીને તમારું રેઝ્યૂમે બનાવીએ! સૌથી પહેલા, તમારું પૂરું નામ શું છે?",
    questionHi: "आइए मिलकर आपका रेज़्यूमे बनाएं! सबसे पहले, आपका पूरा नाम क्या है?",
    questionFr: "Créons votre CV ensemble ! Tout d'abord, quel est votre nom complet ?",
    hint: "Speak or type your full name (e.g., Alex Johnson).",
  },
  {
    step: 2,
    field: "email",
    title: "Contact Info & Email",
    question: "Great! What is your email address and current city?",
    questionGu: "સરસ! તમારું ઈમેઇલ સરનામું અને શહેર શું છે?",
    questionHi: "बहुत बढ़िया! आपका ईमेल पता और वर्तमान शहर क्या है?",
    questionFr: "Parfait ! Quelle est votre adresse e-mail et votre ville actuelle ?",
    hint: "e.g. alex@example.com, New York",
    needsConfirmation: true,
  },
  {
    step: 3,
    field: "targetRole",
    title: "Career Goal & Target Role",
    question: "What target role or career track are you aiming for?",
    questionGu: "તમે કયા રોલ અથવા કરિયર ટ્રેક માટે અરજી કરવા માંગો છો?",
    questionHi: "आप किस पद या करियर ट्रैक के लिए लक्ष्य बना रहे हैं?",
    questionFr: "Quel poste ou objectif de carrière visez-vous ?",
    hint: "e.g. Frontend Developer, Data Analyst, Product Manager",
  },
  {
    step: 4,
    field: "education",
    title: "Education",
    question: "What is your educational background, degree, or self-taught path?",
    questionGu: "તમારો શૈક્ષણિક બેકગ્રાઉન્ડ અથવા ડિગ્રી શું છે?",
    questionHi: "आपकी शैक्षिक पृष्ठभूमि या डिग्री क्या है?",
    questionFr: "Quelle est votre formation ou diplôme le plus récent ?",
    hint: "e.g. B.S. in Computer Science or Self-taught Web Developer",
  },
  {
    step: 5,
    field: "skills",
    title: "Key Skills",
    question: "What core technical and professional skills do you possess?",
    questionGu: "તમારી પાસે કઈ ટેકનિકલ અને પ્રોફેશનલ સ્કિલ્સ છે?",
    questionHi: "आपके पास कौन से मुख्य तकनीकी और पेशेवर कौशल हैं?",
    questionFr: "Quelles sont vos principales compétences techniques et professionnelles ?",
    hint: "e.g. React, TypeScript, Node.js, CSS, Git",
  },
  {
    step: 6,
    field: "experience",
    title: "Work Experience",
    question: "Tell me briefly about your past work experience, internships, or freelance roles.",
    questionGu: "તમારા પાછલા કામના અનુભવ અથવા ઇન્ટર્નશિપ વિશે ટૂંકમાં જણાવો.",
    questionHi: "अपने पिछले कार्य अनुभव, इंटर्नशिप या फ्रीलांस प्रोजेक्ट्स के बारे में बताएं।",
    questionFr: "Parlez-moi brièvement de vos expériences professionnelles ou stages.",
    hint: "Describe your responsibilities and impact (or say 'Skip').",
  },
  {
    step: 7,
    field: "projects",
    title: "Projects & Portfolio",
    question: "What notable projects or portfolio work have you built?",
    questionGu: "તમે કયા નોંધપાત્ર પ્રોજેક્ટ્સ અથવા પોર્ટફોલિયો બનાવ્યા છે?",
    questionHi: "आपने कौन से उल्लेखनीय प्रोजेक्ट या पोर्टफोलियो बनाए हैं?",
    questionFr: "Quels projets ou réalisations clés avez-vous développés ?",
    hint: "e.g. E-Commerce Store with Next.js & Stripe",
  },
  {
    step: 8,
    field: "certifications",
    title: "Certifications & Achievements",
    question: "Lastly, do you have any certifications, awards, or key achievements to highlight?",
    questionGu: "છેલ્લે, શું તમારી પાસે કોઈ સર્ટિફિકેટ્સ અથવા સિદ્ધિઓ છે?",
    questionHi: "अंत में, क्या आपके पास कोई प्रमाण पत्र या उपलब्धियां हैं?",
    questionFr: "Enfin, avez-vous des certifications ou réalisations à mettre en avant ?",
    hint: "e.g. AWS Certified Practitioner (or say 'Skip' to finish).",
  },
];

export function getResumeStepPrompt(step: number, lang: string = "en-US"): string {
  const stepObj = RESUME_BUILDER_STEPS.find((s) => s.step === step) || RESUME_BUILDER_STEPS[0];
  if (lang.startsWith("gu")) return stepObj.questionGu;
  if (lang.startsWith("hi")) return stepObj.questionHi;
  if (lang.startsWith("fr")) return stepObj.questionFr;
  return stepObj.question;
}

export function processResumeStepInput(
  currentState: ResumeDraftState,
  userInput: string,
  lang: string = "en-US"
): { nextState: ResumeDraftState; reply: string; isComplete: boolean } {
  const clean = userInput.trim();
  const lower = clean.toLowerCase();

  // 1. Control Action: "Go Back" / "Previous"
  if (
    lower === "go back" ||
    lower === "previous" ||
    lower === "પાછળ જાઓ" ||
    lower === "पीछे जाओ" ||
    lower === "retour"
  ) {
    const prevStep = Math.max(1, currentState.step - 1);
    const updatedState = { ...currentState, step: prevStep };
    return {
      nextState: updatedState,
      reply: `Heading back to Step ${prevStep}: ${getResumeStepPrompt(prevStep, lang)}`,
      isComplete: false,
    };
  }

  // 2. Control Action: "Repeat" / "Say that again"
  if (
    lower === "repeat" ||
    lower === "say that again" ||
    lower === "ફરીથી કહો" ||
    lower === "दोहराएं" ||
    lower === "répéter"
  ) {
    return {
      nextState: currentState,
      reply: getResumeStepPrompt(currentState.step, lang),
      isComplete: false,
    };
  }

  // 3. Control Action: "Skip"
  const isSkip =
    lower === "skip" ||
    lower === "skip this" ||
    lower === "છોડી દો" ||
    lower === "छोड़ो" ||
    lower === "passer";

  const currentStep = currentState.step;
  const updatedState = { ...currentState };

  // Step 2 Confirmation check (for Email)
  if (currentStep === 2 && !currentState.emailConfirmed && !isSkip) {
    // If user says "yes" / "correct" to confirm
    if (lower === "yes" || lower === "correct" || lower === "હા" || lower === "हाँ" || lower === "oui") {
      updatedState.emailConfirmed = true;
      updatedState.step = 3;
      return {
        nextState: updatedState,
        reply: `Email confirmed! Next: ${getResumeStepPrompt(3, lang)}`,
        isComplete: false,
      };
    }

    const emailCandidate = normalizeSpokenEmail(clean);

    // Save candidate email and ask for confirmation
    updatedState.email = emailCandidate;
    return {
      nextState: updatedState,
      reply: `I recorded your email as "${emailCandidate}". Is that correct? (Say Yes to confirm or speak the correction)`,
      isComplete: false,
    };
  }

  // Save the field value based on current step
  switch (currentStep) {
    case 1:
      if (!isSkip) updatedState.fullName = clean;
      break;
    case 2:
      if (!isSkip) updatedState.location = clean;
      break;
    case 3:
      if (!isSkip) updatedState.targetRole = clean;
      break;
    case 4:
      if (!isSkip) updatedState.education = clean;
      break;
    case 5:
      if (!isSkip) {
        updatedState.skills = clean.split(/[,•\n]+/).map((s) => s.trim()).filter(Boolean);
      }
      break;
    case 6:
      if (!isSkip) updatedState.experience = clean;
      break;
    case 7:
      if (!isSkip) updatedState.projects = clean;
      break;
    case 8:
      if (!isSkip) updatedState.certifications = clean;
      break;
  }

  // Advance to next step or complete
  if (currentStep >= 8) {
    updatedState.completed = true;
    const finalMsg =
      lang.startsWith("gu")
        ? `અભિનંદન! તમારું રેઝ્યૂમે સફળતાપૂર્વક તૈયાર થઈ ગયું છે. ચાલો હવે તેને Resume Builder માં જોઈ અને એડિટ કરીએ.`
        : lang.startsWith("hi")
        ? `बधाई हो! आपका रेज़्यूमे सफलतापूर्वक तैयार हो गया है। आइए इसे Resume Builder में देखें।`
        : lang.startsWith("fr")
        ? `Félicitations ! Votre CV a été créé avec succès. Ouvrons l'éditeur de CV pour le finaliser.`
        : `Congratulations! Your conversational resume draft has been created. I'm opening the Resume Builder so you can review and export it.`;

    return {
      nextState: updatedState,
      reply: finalMsg,
      isComplete: true,
    };
  }

  const nextStep = currentStep + 1;
  updatedState.step = nextStep;

  return {
    nextState: updatedState,
    reply: `Got it! Step ${nextStep}: ${getResumeStepPrompt(nextStep, lang)}`,
    isComplete: false,
  };
}
