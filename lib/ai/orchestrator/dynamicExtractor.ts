/**
 * lib/ai/orchestrator/dynamicExtractor.ts
 *
 * UBIX Dynamic Multi-Field Extractor & Intent Classifier:
 * - Extracts multiple fields from single compound utterances
 * - Detects ambiguity and uncertainty thresholds
 * - Detects conversational task-switching mid-flow
 * - Multilingual entity normalization (English, Hindi, Gujarati, Hinglish)
 */

import { TaskId } from "./taskRequirements";

export interface ExtractionResult {
  extractedFields: Record<string, any>;
  fieldConfidences: Record<string, number>;
  ambiguousFields: Record<string, string>; // field -> clarification prompt
  taskSwitchTo?: TaskId;
  detectedLanguage?: string;
  isSkip?: boolean;
  isConfirmation?: boolean;
  isRejection?: boolean;
  isUnknownOrDontKnow?: boolean;
  isInterruption?: boolean;
  isWhyQuestion?: boolean;
  isHelpRequest?: boolean;
  rawText: string;
}

export function extractFromUtterance(text: string, currentTaskId?: TaskId): ExtractionResult {
  const clean = text.trim();
  const lower = clean.toLowerCase();

  const extracted: Record<string, any> = {};
  const confidences: Record<string, number> = {};
  const ambiguous: Record<string, string> = {};

  // ── 1. Universal Control Intent Detection ──
  const isSkip = Boolean(
    /^(skip|skip this|pass|next|chod do|chhod do|chhod|nahi chahiye|છોડી દો|छोड़ दो|छोड़ो|passer)\b/i.test(lower)
  );

  const isUnknownOrDontKnow = Boolean(
    /\b(i don't know|dont know|not sure|not really sure|no idea|pata nahi|mujhe nahi pata|mane nathi khabar|khabar nathi|je ne sais pas|weiss nicht)\b/i.test(lower)
  );

  const isInterruption = Boolean(
    /\b(wait,?\s*actually|actually i want to ask|wait a minute|wait a sec|something else|cancel that|never mind|forget about that)\b/i.test(lower)
  );

  const isWhyQuestion = Boolean(
    /\b(why do you need|why do you ask|why are you asking|why is that needed|why do you want to know|why\?|kyun chahiye|kyu|kem joiye|pourquoi)\b/i.test(lower)
  );

  const isHelpRequest = Boolean(
    /^(help|help me|what can you do|what can i do here|madad|madad karo|sahayata|aidez-moi)\b/i.test(lower)
  );

  const isConfirmation = Boolean(
    /^(yes|yeah|yep|yup|correct|sure|definitely|absolutely|confirm|right|haan|haa|ha|sahi hai|barabar|ha chhe|હા|हाँ|oui|si|ja)\b/i.test(lower)
  );

  const isRejection = Boolean(
    /^(no|nope|nah|wrong|incorrect|not that|nahi|nhi|na|nathi|ના|नहीं|non|nein)\b/i.test(lower)
  );

  // ── 2. Dynamic Task Switching Detection ──
  let taskSwitchTo: TaskId | undefined;

  if (
    /\b(forget the roadmap|cancel roadmap|find jobs|look for jobs|search jobs|show me jobs|jobs instead|naukri|nokri|જોબ|नौकरी)\b/i.test(lower) &&
    currentTaskId !== "find_jobs"
  ) {
    taskSwitchTo = "find_jobs";
  } else if (
    /\b(build resume|create resume|make a resume|cv banavo|resume instead|resume builder)\b/i.test(lower) &&
    currentTaskId !== "build_resume"
  ) {
    taskSwitchTo = "build_resume";
  } else if (
    /\b(tailor resume|personalize resume|match job description)\b/i.test(lower)
  ) {
    taskSwitchTo = "tailor_resume";
  } else if (
    /\b(make roadmap|create roadmap|career roadmap|roadmap instead|sikhna hai|banvu che)\b/i.test(lower) &&
    currentTaskId !== "generate_roadmap" &&
    !/\b(forget|cancel)\b/i.test(lower)
  ) {
    taskSwitchTo = "generate_roadmap";
  } else if (
    /\b(practice|quiz|assessment|interview question|mock interview|code drill|test my skills)\b/i.test(lower) &&
    currentTaskId !== "start_practice"
  ) {
    taskSwitchTo = "start_practice";
  }

  // ── 3. Role / Career Track Extraction ──
  const rolePatterns: [RegExp, string][] = [
    [/\b(frontend|front-end|front end|react|next\.js|ui engineer)\b/i, "Frontend Developer"],
    [/\b(backend|back-end|back end|node\.js|python backend|django|java backend|golang)\b/i, "Backend Developer"],
    [/\b(fullstack|full-stack|full stack|mern|mean)\b/i, "Full Stack Developer"],
    [/\b(data science|data scientist|data analyst|machine learning|ml engineer|ai engineer)\b/i, "Data Scientist"],
    [/\b(devops|cloud engineer|sre|platform engineer|kubernetes|aws engineer)\b/i, "DevOps Engineer"],
    [/\b(product manager|product management|pm)\b/i, "Product Manager"],
    [/\b(ui\/ux designer|product designer|ux designer|ui designer|figma designer)\b/i, "UI/UX Designer"],
    [/\b(software developer|software engineer|programmer|coder)\b/i, "Software Engineer"],
  ];

  for (const [pattern, canonicalRole] of rolePatterns) {
    if (pattern.test(lower)) {
      extracted.targetRole = canonicalRole;
      confidences.targetRole = 0.95;
      break;
    }
  }

  // Multilingual Indic role intents:
  // "Mare frontend developer banvu che" (Gujarati)
  // "Mujhe backend developer banna hai" (Hindi)
  if (!extracted.targetRole) {
    const indicMatch = lower.match(/(?:mare|mane|mujhe|main)\s+([a-zA-Z\s]+?)\s+(?:banvu\s+che|banna\s+hai|sikhvu\s+che|sikhna\s+hai)/i);
    if (indicMatch && indicMatch[1].trim()) {
      extracted.targetRole = indicMatch[1].trim();
      confidences.targetRole = 0.85;
    }
  }

  // ── 4. Experience Level Extraction ──
  if (/\b(beginner|fresher|newbie|starting out|zero experience|scratch|novice|pehle se kuch nahi|nathi aavadtu)\b/i.test(lower)) {
    extracted.experienceLevel = "Beginner";
    confidences.experienceLevel = 0.95;
  } else if (/\b(intermediate|some experience|1-2 years|couple years|mid-level|junior developer)\b/i.test(lower)) {
    extracted.experienceLevel = "Intermediate";
    confidences.experienceLevel = 0.9;
  } else if (/\b(advanced|senior|experienced|lead|5\+ years|many years)\b/i.test(lower)) {
    extracted.experienceLevel = "Advanced";
    confidences.experienceLevel = 0.9;
  } else if (/\b(switch|switching|career transition|changing domain|from (?:java|sales|marketing|non-tech))\b/i.test(lower)) {
    extracted.experienceLevel = "Career Switcher";
    confidences.experienceLevel = 0.9;
  }

  // ── 5. Available Learning Hours Extraction (with Ambiguity Reasoning) ──
  // Word-to-number dictionary for natural speech ("two hours", "ten hours")
  const wordToNumber: Record<string, string> = {
    one: "1", two: "2", three: "3", four: "4", five: "5",
    six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
    eleven: "11", twelve: "12", fifteen: "15", twenty: "20",
  };
  let normalizedHoursText = lower;
  for (const [w, d] of Object.entries(wordToNumber)) {
    normalizedHoursText = normalizedHoursText.replace(new RegExp(`\\b${w}\\b`, "g"), d);
  }

  // Case A: Exact hours specified ("2 hours every evening", "10 hours a week", "around ten hours")
  const hoursPerDayMatch = normalizedHoursText.match(/(\d+)\s*(?:hours?|hrs?)\s*(?:every\s+day|daily|per\s+day|a\s+day|each\s+day|every\s+evening)/i);
  if (hoursPerDayMatch) {
    const daily = parseInt(hoursPerDayMatch[1], 10);
    extracted.availableLearningTime = daily * 7;
    confidences.availableLearningTime = 0.95;
  } else {
    const hoursPerWeekMatch = normalizedHoursText.match(/(?:around|about|probably|roughly)?\s*(\d+)\s*(?:hours?|hrs?)\s*(?:a\s+week|per\s+week|weekly|each\s+week)?/i);
    if (hoursPerWeekMatch) {
      extracted.availableLearningTime = parseInt(hoursPerWeekMatch[1], 10);
      confidences.availableLearningTime = 0.9;
    }
  }

  // Case B: Relative or Ambiguous hours ("a few hours", "every evening after college", "some time")
  if (!extracted.availableLearningTime) {
    if (/\b(every evening after college|after college|after work|every evening|shaam ko|sanje)\b/i.test(lower)) {
      extracted.availableLearningTime = 14; // ~2 hrs/day * 7 days
      confidences.availableLearningTime = 0.85;
    } else if (/\b(a few hours|few hours|thoda time|thoda samay|kai kalak)\b/i.test(lower)) {
      extracted.availableLearningTime = 4; // default conservative estimate
      confidences.availableLearningTime = 0.5;
      ambiguous.availableLearningTime = "When you say a few hours, would you say around 3 to 5 hours a week?";
    } else if (/\b(every day|daily|roj|darroj)\b/i.test(lower)) {
      extracted.availableLearningTime = 7; // ~1 hr/day
      confidences.availableLearningTime = 0.7;
      ambiguous.availableLearningTime = "Should we plan for about 1 hour each day (around 7 hours weekly)?";
    } else if (/\b(weekends only|only weekends|shani-ravi)\b/i.test(lower)) {
      extracted.availableLearningTime = 8; // ~4 hrs Sat + Sun
      confidences.availableLearningTime = 0.75;
    } else if (/\b(full time|all day|poora din|pura time)\b/i.test(lower)) {
      extracted.availableLearningTime = 30;
      confidences.availableLearningTime = 0.85;
    }
  }

  // ── 6. Skills & Weak Skills Extraction ──
  const knownSkillList = [
    "react", "javascript", "typescript", "node.js", "nodejs", "python", "html", "css",
    "tailwind", "next.js", "nextjs", "c++", "cpp", "java", "sql", "postgresql",
    "mongodb", "git", "docker", "kubernetes", "aws", "graphql", "recursion", "dsa"
  ];

  const matchedSkills: string[] = [];
  const matchedWeakSkills: string[] = [];

  const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  for (const skill of knownSkillList) {
    const escaped = escapeRegExp(skill);
    const reg = new RegExp(`(?:^|[^a-zA-Z0-9_])${escaped}(?:$|[^a-zA-Z0-9_])`, "i");
    if (reg.test(lower)) {
      // Check if user specifically stated weakness in this skill (e.g. "weak in TypeScript" or "TypeScript is weak")
      const weakBefore = new RegExp(
        `(?:weak in|struggle with|don't know|dont know|bad at|learn|weak|kaccha|nathi aavadtu)\\s+${escaped}`,
        "i"
      );
      const weakAfter = new RegExp(
        `${escaped}\\s+(?:is\\s+weak|is\\s+bad|is\\s+not\\s+strong|weak|kaccha)`,
        "i"
      );
      if (weakBefore.test(lower) || weakAfter.test(lower)) {
        matchedWeakSkills.push(skill);
      } else {
        matchedSkills.push(skill);
      }
    }
  }

  if (matchedSkills.length > 0) {
    extracted.skills = matchedSkills;
    confidences.skills = 0.9;
  }
  if (matchedWeakSkills.length > 0) {
    extracted.weakSkills = matchedWeakSkills;
    confidences.weakSkills = 0.9;
  }

  // ── 7. Job Work Mode & Location Extraction ──
  if (/\b(remote|work from home|wfh|ghar baithe)\b/i.test(lower)) {
    extracted.workMode = "Remote";
    confidences.workMode = 0.95;
  } else if (/\b(hybrid)\b/i.test(lower)) {
    extracted.workMode = "Hybrid";
    confidences.workMode = 0.95;
  } else if (/\b(onsite|on-site|office)\b/i.test(lower)) {
    extracted.workMode = "Onsite";
    confidences.workMode = 0.95;
  }

  const locationMatch = lower.match(/(?:in|at|near|around|city of)\s+([a-zA-Z\s]+?)(?:$|\s+(?:jobs?|roles?|positions?|remote|hybrid))/i);
  if (locationMatch && locationMatch[1].trim()) {
    const locCandidate = locationMatch[1].trim();
    if (!["remote", "hybrid", "onsite", "tech", "software"].includes(locCandidate)) {
      extracted.location = locCandidate.charAt(0).toUpperCase() + locCandidate.slice(1);
      confidences.location = 0.85;
    }
  }

  // ── 8. Language Detection ──
  let detectedLanguage = "en";
  if (/[\u0900-\u097F]/.test(clean)) {
    detectedLanguage = "hi";
  } else if (/[\u0A80-\u0AFF]/.test(clean)) {
    detectedLanguage = "gu";
  } else if (/\b(kya|hai|ho|hain|banna|sikhna|naukri|chahiye|pehle|mujhe|mera|meri|mere|har|hafte|ke|liye|de|sakta|sakti|kar|raha|rahi|theek|accha|kitne|ghante)\b/i.test(lower)) {
    detectedLanguage = "hinglish";
  } else if (/\b(mare|mane|che|chhe|banvu|sikhvu|nathi|khabar|su|shu|aavadtu|karyu|hove|aabhar|ketla|kalak)\b/i.test(lower)) {
    detectedLanguage = "gujlish";
  }

  return {
    extractedFields: extracted,
    fieldConfidences: confidences,
    ambiguousFields: ambiguous,
    taskSwitchTo,
    detectedLanguage,
    isSkip,
    isConfirmation,
    isRejection,
    isUnknownOrDontKnow,
    isInterruption,
    isWhyQuestion,
    isHelpRequest,
    rawText: text,
  };
}
