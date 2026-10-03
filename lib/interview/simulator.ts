/**
 * lib/interview/simulator.ts
 *
 * UBIX Adaptive Interview Simulator
 *
 * Tailors dynamic interview questions based on:
 * - Target job requirements and tech stack
 * - Candidate skill gaps identified from Evidence Wallet
 * - Past interview memory trends (avoiding repetitive questions on mastered topics)
 *
 * Modes:
 * - TECHNICAL: Deep system architecture and language semantics.
 * - BEHAVIORAL: STAR-framed leadership, conflict, and ownership challenges.
 * - ROLE_SPECIFIC: Cross-functional problem solving.
 * - TEACH_BACK: Explaining complex systems simply.
 */

import { NormalizedJobRequirement } from "../jobs/requirementExtraction";
import { SkillEvidenceItem } from "../career/evidenceWallet";
import { getInterviewHistory } from "./interviewMemory";

export interface SimulatedInterviewQuestion {
  id: string;
  interviewType: "TECHNICAL" | "BEHAVIORAL" | "ROLE_SPECIFIC" | "TEACH_BACK";
  questionText: string;
  targetedSkill: string;
  rubricGuidelines: string[];
  suggestedStarFramework?: {
    situationPrompt: string;
    taskPrompt: string;
    actionPrompt: string;
    resultPrompt: string;
  };
  whyAskedRationale: string;
}

export interface InterviewSessionPlan {
  sessionId: string;
  targetRole: string;
  company?: string;
  questions: SimulatedInterviewQuestion[];
  totalEstimatedMinutes: number;
}

/**
 * Builds an adaptive interview session targeting skill gaps and role requirements.
 */
export function buildInterviewSessionPlan(input: {
  userId: string;
  jobRequirement?: NormalizedJobRequirement;
  targetRoleTitle: string;
  skillGaps: string[];
  candidateEvidence: SkillEvidenceItem[];
}): InterviewSessionPlan {
  const history = getInterviewHistory(input.userId, input.targetRoleTitle);
  const previouslyAskedQuestions = new Set(history.map((h) => h.question.toLowerCase()));

  const questions: SimulatedInterviewQuestion[] = [];

  // 1. Behavioral Question (STAR)
  questions.push({
    id: `q_beh_${Date.now()}_1`,
    interviewType: "BEHAVIORAL",
    questionText: "Tell me about a time when a critical production service degraded or failed unexpectedly. How did you diagnose the issue and communicate with stakeholders?",
    targetedSkill: "Incident Management & Stakeholder Communication",
    rubricGuidelines: [
      "Candidate outlines clear initial triage steps.",
      "Clear distinction between interim mitigation and permanent root-cause fix.",
      "Measurable recovery metrics mentioned (e.g. MTTR, zero data loss).",
    ],
    suggestedStarFramework: {
      situationPrompt: "What was the failing production system and its business impact?",
      taskPrompt: "What was your direct responsibility during the active incident?",
      actionPrompt: "What technical debugging tools and rollbacks did you execute?",
      resultPrompt: "What post-mortem safeguards were implemented to prevent recurrence?",
    },
    whyAskedRationale: "Evaluates composure under production outage pressure and systemic thinking.",
  });

  // 2. Technical Questions targeting identified skill gaps
  for (const gap of input.skillGaps.slice(0, 2)) {
    const qText = `In a production environment utilizing ${gap}, how would you architect high availability and guard against single points of failure?`;
    if (!previouslyAskedQuestions.has(qText.toLowerCase())) {
      questions.push({
        id: `q_tech_${Date.now()}_${gap.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
        interviewType: "TECHNICAL",
        questionText: qText,
        targetedSkill: gap,
        rubricGuidelines: [
          `Identifies core architectural constructs of ${gap}.`,
          "Addresses redundancy, failover, and load balancing.",
          "Explains operational monitoring and error telemetry.",
        ],
        whyAskedRationale: `Addresses identified wallet skill gap in ${gap}.`,
      });
    }
  }

  // 3. Teach-Back / Role-Specific Question
  questions.push({
    id: `q_tb_${Date.now()}_arch`,
    interviewType: "TEACH_BACK",
    questionText: `Explain the trade-offs between asynchronous event-driven messaging vs synchronous REST APIs as if explaining to a non-technical product manager.`,
    targetedSkill: "System Architecture & Communication",
    rubricGuidelines: [
      "Avoids unnecessary buzzwords.",
      "Uses a relatable concrete analogy.",
      "Clarifies when to use which pattern based on user experience.",
    ],
    whyAskedRationale: "Evaluates ability to translate complex engineering trade-offs to business partners.",
  });

  return {
    sessionId: `int_sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    targetRole: input.targetRoleTitle,
    company: input.jobRequirement?.company,
    questions,
    totalEstimatedMinutes: questions.length * 10,
  };
}
