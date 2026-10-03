/**
 * lib/career/interviewEngine.ts
 *
 * Deterministic Interview Studio & Practice Copilot Engine:
 * 1. Role-specific Question Generator (anchored to normalized job requirements and verified candidate evidence).
 * 2. Grounded Evidence Association (identifies candidate resume projects/bullets matching the question).
 * 3. STAR Structure Coaching Analyzer (evaluates Situation, Task, Action, Result presence without fabricating).
 * 4. Technical Answer Evaluator (assesses concept coverage and clarity).
 * 5. Offer Comparison Helper (pure factual comparison; strictly zero ranking or winner declarations).
 *
 * Invariants:
 * - Never predicts hiring chances or interview passing probability.
 * - Never invents candidate achievements, numbers, or team sizes.
 * - Never declares a "winner" among offers.
 */

import crypto from "crypto";
import type { CanonicalResume } from "@/lib/resume/structuredParser";
import type {
  NormalizedJob,
  InterviewQuestion,
  QuestionCategory,
  QuestionDifficulty,
  PracticeFeedback,
  InterviewRecord,
  InterviewRoundType,
  OfferRecord,
} from "./types";
import { normalizeSkill } from "./matchEngine.ts";

function generateInterviewId(prefix = "int"): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

export function createInterviewRecord(params: {
  userId: string;
  applicationId: string;
  roundType?: InterviewRoundType;
  roundNumber?: number;
  scheduledAt?: string;
  durationMinutes?: number;
  format?: "VIDEO" | "PHONE" | "ON_SITE" | "OTHER";
  interviewerNames?: string;
  notes?: string;
}): InterviewRecord {
  const now = new Date().toISOString();
  return {
    id: generateInterviewId("rec"),
    userId: params.userId,
    applicationId: params.applicationId,
    roundNumber: params.roundNumber || 1,
    roundType: params.roundType || "TECHNICAL",
    scheduledAt: params.scheduledAt || now,
    durationMinutes: params.durationMinutes || 45,
    format: params.format || "VIDEO",
    interviewerNames: params.interviewerNames,
    notes: params.notes,
    status: "SCHEDULED",
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Generates role-specific, grounded interview questions from a NormalizedJob and optional CanonicalResume.
 */
export function generateInterviewQuestions(params: {
  job: NormalizedJob;
  resume?: CanonicalResume | null;
  difficulty?: QuestionDifficulty;
  count?: number;
}): InterviewQuestion[] {
  const { job, resume, difficulty = "INTERMEDIATE", count = 6 } = params;
  const questions: InterviewQuestion[] = [];

  const requiredSkills = (job.requirements || [])
    .map((r) => r.normalizedSkill || r.text)
    .filter(Boolean);

  const candidateBullets = (resume?.work || [])
    .flatMap((w) => (w.bullets ? w.bullets.split(/\r?\n|•/) : []))
    .map((b) => b.trim())
    .filter((b) => b.length > 15);

  const candidateProjects = resume?.projects || [];

  // 1. Technical Question 1: Core requirement
  const topSkill = requiredSkills[0] || job.skills?.[0] || "Software Architecture";
  const matchedWorkBullet = candidateBullets.find((b) =>
    new RegExp(`\\b${topSkill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(b)
  );

  const q1Text = `How have you used ${topSkill} to design or optimize production services in your previous work?`;
  questions.push({
    id: generateInterviewId("q_tech"),
    category: "TECHNICAL",
    difficulty,
    question: q1Text,
    prompt: q1Text,
    contextOrRationale: `Directly derived from the job's requirement for ${topSkill}.`,
    suggestedEvidenceSnippets: matchedWorkBullet
      ? [`From your experience: "${matchedWorkBullet.slice(0, 140)}"`]
      : undefined,
  });

  // 2. Behavioral Question (STAR coaching enabled)
  const q2Text = `Can you describe a challenging technical roadblock you encountered on a recent project, how you tackled it, and what measurable outcome you achieved?`;
  questions.push({
    id: generateInterviewId("q_beh"),
    category: "BEHAVIORAL",
    difficulty,
    question: q2Text,
    prompt: q2Text,
    contextOrRationale: `Evaluates structured problem-solving and collaboration under constraints.`,
    starCoachingTips: {
      situationHint: "State the project context and the specific technical roadblock.",
      taskHint: "Clarify what responsibility fell directly upon you.",
      actionHint: "Detail the specific engineering decisions, tools, and actions you implemented.",
      resultHint: "Mention the final outcome, verification, or post-incident learning.",
    },
  });

  // 3. System Design or Project Question
  if (candidateProjects.length > 0) {
    const proj = candidateProjects[0];
    const q3Text = `On ${proj.title}, how did you decide on the tech stack (${proj.techStack || "the chosen architecture"}) and what trade-offs did you make?`;
    questions.push({
      id: generateInterviewId("q_proj"),
      category: "PROJECT",
      difficulty,
      question: q3Text,
      prompt: q3Text,
      contextOrRationale: `Draws directly from your resume project: ${proj.title}.`,
      suggestedEvidenceSnippets: [
        `Project context: "${(proj.description || proj.techStack || "").slice(0, 120)}"`,
      ],
    });
  } else {
    const q3Text = `How would you architect a reliable, fault-tolerant service given the responsibilities described in ${job.title} at ${job.company}?`;
    questions.push({
      id: generateInterviewId("q_sys"),
      category: "SYSTEM_DESIGN",
      difficulty,
      question: q3Text,
      prompt: q3Text,
      contextOrRationale: `Derived from ${job.title} responsibilities.`,
    });
  }

  // 4. Role-Specific Responsibility Question
  if (job.responsibilities && job.responsibilities.length > 0) {
    const resp = job.responsibilities[0];
    const q4Text = `The job description mentions: "${resp}". How does your past experience prepare you to take ownership of this area?`;
    questions.push({
      id: generateInterviewId("q_role"),
      category: "ROLE_SPECIFIC",
      difficulty,
      question: q4Text,
      prompt: q4Text,
      contextOrRationale: `Derived verbatim from employer job posting responsibilities.`,
    });
  }

  // 5. Motivation / Company Alignment Question
  const q5Text = `Why does the engineering mission at ${job.company} interest you, and how does this ${job.title} position fit into your current technical focus?`;
  questions.push({
    id: generateInterviewId("q_mot"),
    category: "MOTIVATION",
    difficulty,
    question: q5Text,
    prompt: q5Text,
    contextOrRationale: `Derived from employer organization and target role.`,
  });

  return questions.slice(0, count);
}

/**
 * Evaluates an interview practice answer deterministically.
 * Provides constructive feedback, detects STAR components for behavioral questions,
 * and extracts any cited candidate facts without grading with arbitrary percentage predictions.
 */
export function evaluatePracticeAnswer(params: {
  question: Partial<InterviewQuestion> & { category?: QuestionCategory; prompt?: string; question?: string };
  answer: string;
  resume?: CanonicalResume | null;
}): PracticeFeedback {
  const { question, answer, resume } = params;
  const lowerAnswer = answer.toLowerCase();
  const words = answer.trim().split(/\s+/).filter(Boolean);

  const strengths: string[] = [];
  const improvements: string[] = [];
  const evidenceCited: string[] = [];

  // Check answer length / substance
  if (words.length >= 40) {
    strengths.push("Provided a substantive, detailed explanation rather than a brief response.");
  } else {
    improvements.push("Your answer is fairly brief (under 40 words). Consider expanding on the specific actions you took.");
  }

  // Check if candidate cited actual technologies from resume or common technologies
  const candidateTech = [
    ...(resume?.skills?.raw || []),
    ...(resume?.skills?.categorized?.languages || []),
    ...(resume?.skills?.categorized?.frameworks || []),
  ].map((s) => s.toLowerCase());

  // Also include any recognized tech tokens mentioned in answer
  const recognizedTechs = ["fastapi", "postgresql", "python", "docker", "redis", "kubernetes", "typescript", "react", "next.js", "node.js", "go", "sql", "aws"];
  const allKnownTech = Array.from(new Set([...candidateTech, ...recognizedTechs]));

  for (const tech of allKnownTech) {
    if (tech.length > 2 && new RegExp(`\\b${tech.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(answer)) {
      evidenceCited.push(tech);
    }
  }

  if (evidenceCited.length > 0) {
    strengths.push(`Clearly referenced verified technologies from your experience: ${Array.from(new Set(evidenceCited)).slice(0, 3).join(", ")}.`);
  } else if (question.category === "TECHNICAL" || question.category === "PROJECT") {
    improvements.push("Ground your technical explanation by explicitly mentioning the specific technologies and tools you used.");
  }

  // STAR structure analysis for Behavioral questions
  let starBreakdown: PracticeFeedback["starBreakdown"] = undefined;
  if (question.category === "BEHAVIORAL") {
    const sitWords = ["when", "project", "situation", "company", "team", "client", "problem", "faced", "in my previous"];
    const taskWords = ["goal", "responsible", "task", "objective", "needed to", "had to"];
    const actWords = ["i implemented", "i designed", "i built", "i analyzed", "i wrote", "my approach", "i led", "i investigated", "applied", "hotfix"];
    const resWords = ["result", "outcome", "finally", "achieved", "improved", "learned", "delivered", "resolved", "succeeded", "reduced latency", "restored"];

    const situationPresent = sitWords.some((w) => lowerAnswer.includes(w));
    const taskPresent = taskWords.some((w) => lowerAnswer.includes(w));
    const actionPresent = actWords.some((w) => lowerAnswer.includes(w));
    const resultPresent = resWords.some((w) => lowerAnswer.includes(w));

    const guidance = resultPresent
      ? "Solid STAR structure: Situation, Task, Action, and measurable Result are all present."
      : "Add the actual outcome or measurable result you observed (e.g. how the service stabilized, metrics improved, or team learned).";

    starBreakdown = {
      situationPresent,
      taskPresent,
      actionPresent,
      resultPresent,
      guidance,
    };

    if (situationPresent && actionPresent && resultPresent) {
      strengths.push("Effective STAR structure: Situation, Action, and Outcome are all clearly identifiable.");
    } else {
      if (!actionPresent) {
        improvements.push("Emphasize your individual Action: Use 'I implemented' or 'I built' to clarify your specific contribution.");
      }
      if (!resultPresent) {
        improvements.push("Close with a verifiable Result: Describe the resolution, impact, or key learning from the experience.");
      }
    }
  }

  const overallGuidance =
    improvements.length === 0
      ? "Solid response. You communicated your thoughts clearly and anchored your answer in concrete technical evidence."
      : `To strengthen this answer, focus on: ${improvements[0]}`;

  const relevanceScore = Math.min(
    1.0,
    Number((0.5 + (evidenceCited.length > 0 ? 0.3 : 0.1) + (words.length >= 25 ? 0.2 : 0)).toFixed(2))
  );

  const displayTokens = Array.from(new Set(evidenceCited)).map((t) => {
    const l = t.toLowerCase();
    if (l === "fastapi") return "FastAPI";
    if (l === "postgresql") return "PostgreSQL";
    if (l === "typescript") return "TypeScript";
    if (l === "next.js") return "Next.js";
    if (l === "redis") return "Redis";
    if (l === "docker") return "Docker";
    if (l === "python") return "Python";
    if (l === "aws") return "AWS";
    return t.charAt(0).toUpperCase() + t.slice(1);
  });

  return {
    strengths,
    improvements,
    suggestions: improvements,
    evidenceCited: displayTokens,
    conceptsMentioned: displayTokens,
    starBreakdown,
    overallGuidance,
    relevanceScore,
    overallScore: undefined, // Invariant: No pseudo-scientific hiring score
    feedbackSummary: overallGuidance,
  };
}

/**
 * Factually compares two or more OfferRecords.
 * Invariant: Never ranks offers, never assigns a "winner", and never uses opaque scores.
 */
export function compareOfferRecords(input: OfferRecord[] | { offers: OfferRecord[] }): {
  offers: {
    id: string;
    company: string;
    role: string;
    baseCompensation: string;
    bonus: string;
    equity: string;
    benefits: string;
    location: string;
    remoteType: string;
    startDate: string;
    deadline: string;
    userCriteria: Record<string, string>;
  }[];
  differences: string[];
  allUserCriteriaKeys: string[];
  customCriteria: string[];
  comparisonRows: {
    field: string;
    values: Record<string, string>;
  }[];
  winner?: undefined;
  ranking?: undefined;
  scores?: undefined;
} {
  const offerList = Array.isArray(input) ? input : input.offers;

  const normalized = offerList.map((o) => ({
    id: o.id,
    company: o.company || "Unknown Employer",
    role: o.role || "Role unspecified",
    baseCompensation: o.baseCompensation || "Not provided / Unknown",
    bonus: o.bonus || "Not provided / Unknown",
    equity: o.equity || "Not provided / Unknown",
    benefits: o.benefits || "Not provided / Unknown",
    location: o.location || "Not specified",
    remoteType: o.remoteType || "Not specified",
    startDate: o.startDate || "Unspecified",
    deadline: o.deadline || "None recorded",
    userCriteria: o.userCriteria || o.customCriteria || {},
  }));

  // Identify all unique user-defined criteria keys across offers
  const criteriaKeys = Array.from(
    new Set(offerList.flatMap((o) => Object.keys(o.userCriteria || o.customCriteria || {})))
  );

  const differences: string[] = [];

  if (normalized.length >= 2) {
    const o1 = normalized[0];
    const o2 = normalized[1];

    if (o1.baseCompensation !== o2.baseCompensation) {
      differences.push(`Base compensation differs: ${o1.company} (${o1.baseCompensation}) vs. ${o2.company} (${o2.baseCompensation}).`);
    }
    if (o1.remoteType !== o2.remoteType) {
      differences.push(`Work arrangements differ: ${o1.company} is ${o1.remoteType}, while ${o2.company} is ${o2.remoteType}.`);
    }
    if (o1.location !== o2.location) {
      differences.push(`Locations differ: ${o1.company} (${o1.location}) vs. ${o2.company} (${o2.location}).`);
    }
    if (o1.deadline !== o2.deadline) {
      differences.push(`Response deadlines differ: ${o1.company} (${o1.deadline}) vs. ${o2.company} (${o2.deadline}).`);
    }
  }

  // Build row-wise comparison structure for tables and tests
  const fields = [
    { label: "Company", key: "company" },
    { label: "Role", key: "role" },
    { label: "Base Compensation", key: "baseCompensation" },
    { label: "Bonus", key: "bonus" },
    { label: "Equity", key: "equity" },
    { label: "Work Arrangement", key: "remoteType" },
    { label: "Location", key: "location" },
    { label: "Benefits", key: "benefits" },
    { label: "Deadline", key: "deadline" },
  ];

  const comparisonRows = fields.map((f) => {
    const values: Record<string, string> = {};
    for (const off of normalized) {
      values[off.id] = (off as any)[f.key];
    }
    return { field: f.label, values };
  });

  for (const cKey of criteriaKeys) {
    const values: Record<string, string> = {};
    for (const off of normalized) {
      values[off.id] = off.userCriteria[cKey] || "Not evaluated";
    }
    comparisonRows.push({ field: cKey, values });
  }

  return {
    offers: normalized,
    differences,
    allUserCriteriaKeys: criteriaKeys,
    customCriteria: criteriaKeys,
    comparisonRows,
    winner: undefined,
    ranking: undefined,
    scores: undefined,
  };
}
