/**
 * lib/ai/orchestrator/pageCapabilities.ts
 *
 * UBIX Semantic Page Capabilities & Context Resolver:
 * Pages provide semantic context — NOT a hardcoded question list.
 * Supports blind-first announcements and contextual awareness.
 */

import { TaskId } from "./taskRequirements";

export interface PageCapabilityContext {
  workspace: "roadmap" | "practice" | "resume" | "jobs" | "assistant";
  capability: string;
  availableActions: string[];
  defaultTaskId: TaskId;
  situationalGreeting: {
    en: (hasData: boolean, detail?: string) => string;
    hi: (hasData: boolean, detail?: string) => string;
    gu: (hasData: boolean, detail?: string) => string;
  };
}

export const PAGE_CAPABILITIES: Record<string, PageCapabilityContext> = {
  roadmap: {
    workspace: "roadmap",
    capability: "career planning and milestone progression",
    availableActions: [
      "generate roadmap",
      "modify roadmap pace",
      "explain roadmap milestones",
      "adjust target timeline",
      "explore curated courses",
      "review progress telemetry",
    ],
    defaultTaskId: "generate_roadmap",
    situationalGreeting: {
      en: (hasData, detail) =>
        hasData
          ? `You are in Roadmap. Your ${detail || "career"} roadmap is active. Would you like me to walk through your next milestones, modify your pace, or explain key skill gaps?`
          : "You are in Roadmap. We can build your phased career roadmap. What target role are you aiming for?",
      hi: (hasData, detail) =>
        hasData
          ? `आप रोडमैप में हैं। आपका ${detail || "करियर"} रोडमैप तैयार है। क्या आप अगले माइलस्टोन देखना चाहते हैं या गति बदलना चाहते हैं?`
          : "आप रोडमैप में हैं। आइए आपका करियर रोडमैप बनाएं। आप किस पद के लिए लक्ष्य बना रहे हैं?",
      gu: (hasData, detail) =>
        hasData
          ? `તમે રોડમેપમાં છો. તમારો ${detail || "કરિયર"} રોડમેપ સક્રિય છે. શું તમે આગળના સ્ટેપ્સ જોવા માંગો છો કે પેસ બદલવા માંગો છો?`
          : "તમે રોડમેપમાં છો. ચાલો તમારો કરિયર રોડમેપ બનાવીએ. તમે કયા રોલ માટે લક્ષ્ય રાખી રહ્યા છો?",
    },
  },

  practice: {
    workspace: "practice",
    capability: "skill assessment and adaptive technical practice",
    availableActions: [
      "start practice drill",
      "start adaptive assessment",
      "explain concept",
      "review past mistakes",
      "switch language track",
    ],
    defaultTaskId: "start_practice",
    situationalGreeting: {
      en: (hasData, detail) =>
        hasData
          ? `You are in Practice. I see recent practice in ${detail || "technical tracks"}. Would you like to resume your drills or test an adaptive assessment?`
          : "You are in Technical Practice. What concept or language would you like to drill today?",
      hi: (hasData, detail) =>
        hasData
          ? `आप प्रैक्टिस में हैं। ${detail || "तकनीकी विषयों"} पर अभ्यास जारी रखें या नया टेस्ट शुरू करें?`
          : "आप प्रैक्टिस में हैं। आज आप किस विषय या भाषा पर अभ्यास करना चाहते हैं?",
      gu: (hasData, detail) =>
        hasData
          ? `તમે પ્રેક્ટિસમાં છો. ${detail || "ટેકનિકલ ટોપિક્સ"} પર અભ્યાસ ચાલુ રાખો કે નવો ટેસ્ટ આપવો છે?`
          : "તમે પ્રેક્ટિસમાં છો. આજે તમે કયા ટોપિક પર પ્રેક્ટિસ કરવા માંગો છો?",
    },
  },

  resume: {
    workspace: "resume",
    capability: "resume creation, ATS audit, and role personalization",
    availableActions: [
      "build conversational resume",
      "tailor resume for job",
      "audit resume for ATS",
      "export PDF resume",
    ],
    defaultTaskId: "build_resume",
    situationalGreeting: {
      en: (hasData, detail) =>
        hasData
          ? `You are in Resume Suite. Your ${detail || "active"} resume is loaded. Would you like an ATS compliance audit or help tailoring it for a job?`
          : "You are in Resume Suite. Would you like me to help you create a resume step-by-step, or upload an existing document?",
      hi: (hasData, detail) =>
        hasData
          ? `आप रेज़्यूमे सूट में हैं। क्या आप अपने रेज़्यूमे का एटीएस ऑडिट करना चाहते हैं या किसी नौकरी के लिए तैयार करना चाहते हैं?`
          : "आप रेज़्यूમે सूट में हैं। क्या आप नया रेज़्यूમે बनाना चाहते हैं या पुराना अपलोड करना चाहते हैं?",
      gu: (hasData, detail) =>
        hasData
          ? `તમે રેઝ્યૂમે સ્યૂટમાં છો. શું તમે એટીએસ સ્કોર ચેક કરવા માંગો છો કે જોબ માટે ટેલર કરવા માંગો છો?`
          : "તમે રેઝ્યૂમે સ્યૂટમાં છો. શું તમે નવું રેઝ્યૂમે બનાવવા માંગો છો કે જૂનું અપલોડ કરવું છે?",
    },
  },

  jobs: {
    workspace: "jobs",
    capability: "job discovery, local opportunities, and matching alerts",
    availableActions: [
      "find matching jobs",
      "filter remote opportunities",
      "set automated role alert",
      "inspect local opportunities map",
    ],
    defaultTaskId: "find_jobs",
    situationalGreeting: {
      en: (hasData, detail) =>
        hasData
          ? `You are in Job Discovery. Showing opportunities matching ${detail || "your profile"}. Would you like to filter by remote, salary, or local distance?`
          : "You are in Job Discovery. What role and location should I search for?",
      hi: (hasData, detail) =>
        hasData
          ? `आप जॉब डिस्कवरी में हैं। ${detail || "आपकी प्रोफाइल"} से मिलते पद उपलब्ध हैं। क्या आप रिमोट या स्थानीय नौकरियां खोजना चाहते हैं?`
          : "आप जॉब डिस्कवरी में हैं। आप किस पद और स्थान पर नौकरी खोजना चाहते हैं?",
      gu: (hasData, detail) =>
        hasData
          ? `તમે જોબ્સમાં છો. ${detail || "તમારી પ્રોફાઇલ"} અનુસાર જોબ્સ ઉપલબ્ધ છે. શું તમારે રિમોટ કે લોકલ જોબ્સ જોવી છે?`
          : "તમે જોબ્સમાં છો. તમે કયા રોલ અને શહેરમાં જોબ શોધવા માંગો છો?",
    },
  },

  assistant: {
    workspace: "assistant",
    capability: "central career intelligence copilot",
    availableActions: [
      "general career guidance",
      "voice navigation",
      "interview simulation",
      "portfolio strategy",
    ],
    defaultTaskId: "general_inquiry",
    situationalGreeting: {
      en: (hasData, detail) =>
        hasData
          ? `Welcome back, ${detail || "there"}. How can I assist your career goals today?`
          : "Hello! I am UBIX, your cognitive career assistant. How can I help you today?",
      hi: (hasData, detail) =>
        hasData
          ? `नमस्ते ${detail || ""}! आज आपके करियर में मैं किस प्रकार मदद कर सकता हूँ?`
          : "नमस्ते! मैं उबिक्स हूँ, आपका करियर सहायक। मैं आपकी कैसे मदद कर सकता हूँ?",
      gu: (hasData, detail) =>
        hasData
          ? `નમસ્તે ${detail || ""}! આજે તમારી કરિયરમાં હું કેવી રીતે મદદ કરી શકું?`
          : "નમસ્તે! હું યુબિક્સ છું, તમારો કરિયર આસિસ્ટન્ટ. હું તમને કેવી રીતે મદદ કરી શકું?",
    },
  },
};

/**
 * Resolves semantic page context given pathname.
 */
export function resolvePageCapability(pathname: string): PageCapabilityContext {
  const clean = pathname.toLowerCase().replace(/^\//, "");
  if (clean.startsWith("roadmap") || clean.startsWith("journey") || clean.startsWith("learning") || clean.startsWith("progress")) {
    return PAGE_CAPABILITIES.roadmap;
  }
  if (clean.startsWith("practice")) {
    return PAGE_CAPABILITIES.practice;
  }
  if (clean.startsWith("resume")) {
    return PAGE_CAPABILITIES.resume;
  }
  if (clean.startsWith("jobs") || clean.startsWith("opportunities") || clean.startsWith("local")) {
    return PAGE_CAPABILITIES.jobs;
  }
  return PAGE_CAPABILITIES.assistant;
}
