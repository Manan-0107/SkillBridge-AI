import { RoleId } from "./types";

export type FeatureId = "resume" | "roadmap" | "courses" | "practice" | "local";
export type ResumeTab = "analyzer" | "personalizer" | "builder";

export type ParsedIntent = {
  feature: FeatureId | null;
  resumeTab?: ResumeTab;
  role?: RoleId;
  reply: string;
};

const roleHints: { role: RoleId; keys: string[] }[] = [
  { role: "frontend", keys: ["frontend", "front-end", "front end", "react", "ui engineer"] },
  { role: "backend", keys: ["backend", "back-end", "back end", "node", "api engineer"] },
  { role: "data", keys: ["data analyst", "data scientist", "machine learning", "ml engineer"] },
  { role: "product", keys: ["product manager", " product ", "pm role"] },
  { role: "design", keys: ["product designer", "ux", "ui design", "figma"] },
  { role: "devops", keys: ["devops", "sre", "platform engineer", "kubernetes"] },
];

function includesAny(text: string, keys: string[]) {
  return keys.some((k) => text.includes(k));
}

export function parseIntent(raw: string): ParsedIntent {
  const text = raw.toLowerCase().trim();
  const role = roleHints.find((r) => includesAny(text, r.keys))?.role;

  if (
    includesAny(text, [
      "build resume",
      "create resume",
      "write resume",
      "resume builder",
      "from scratch",
    ])
  ) {
    return {
      feature: "resume",
      resumeTab: "builder",
      role,
      reply: "Opening the resume builder so you can draft from scratch.",
    };
  }

  if (
    includesAny(text, [
      "tailor",
      "personalize",
      "personaliser",
      "adapt my resume",
      "target role resume",
    ])
  ) {
    return {
      feature: "resume",
      resumeTab: "personalizer",
      role,
      reply: "Taking you to resume personalizer to tailor it for your target role.",
    };
  }

  if (
    includesAny(text, [
      "resume",
      "cv",
      "analyze",
      "analyse",
      "ats",
      "score my",
    ])
  ) {
    return {
      feature: "resume",
      resumeTab: "analyzer",
      role,
      reply: "Opening resume analyzer — you can paste a resume when you're ready.",
    };
  }

  if (
    includesAny(text, [
      "roadmap",
      "career path",
      "career plan",
      "what should i learn",
      "skill path",
    ])
  ) {
    return {
      feature: "roadmap",
      role,
      reply: "Opening your career roadmap.",
    };
  }

  if (
    includesAny(text, [
      "course",
      "udemy",
      "coursera",
      "learn",
      "class",
      "certification",
    ])
  ) {
    return {
      feature: "courses",
      role,
      reply: "Here are curated courses for your path.",
    };
  }

  if (
    includesAny(text, [
      "practice",
      "interview",
      "leetcode",
      "codedex",
      "codepip",
      "coding challenge",
    ])
  ) {
    return {
      feature: "practice",
      role,
      reply: "Opening the practice hub for interview-style work.",
    };
  }

  if (
    includesAny(text, [
      "job",
      "internship",
      "meetup",
      "nearby",
      "local",
      "around me",
      "opportunities",
    ])
  ) {
    return {
      feature: "local",
      role,
      reply: "Finding local opportunities near you.",
    };
  }

  return {
    feature: null,
    role,
    reply:
      "I can take you to resume tools, a career roadmap, courses, practice, or local opportunities. Try “analyze my resume” or “show internships near me.”",
  };
}
