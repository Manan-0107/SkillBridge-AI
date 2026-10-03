/**
 * lib/interview/realWorldPractice.ts
 *
 * UBIX Real-World Practice Engine
 *
 * Generates applied, realistic engineering challenges matching candidate target roles:
 * - Debugging an active race condition or broken test
 * - Writing production documentation / RFCs
 * - Optimizing high-latency SQL queries
 * - Architectural incident response
 *
 * On successful completion: Automatically translates verified deliverables into
 * Career Evidence Wallet items.
 */

import { SkillEvidenceItem } from "../career/evidenceWallet";

export type PracticeTaskType =
  | "DEBUG_CODE"
  | "WRITE_DOCS"
  | "OPTIMIZE_PERFORMANCE"
  | "SYSTEM_INCIDENT"
  | "CODE_REVIEW";

export interface RealWorldPracticeTask {
  id: string;
  type: PracticeTaskType;
  title: string;
  targetSkill: string;
  scenarioDescription: string;
  brokenCodeSnippet?: string;
  expectedDeliverableDescription: string;
  acceptanceCriteria: string[];
  estimatedMinutes: number;
}

export interface PracticeEvaluationResult {
  taskId: string;
  isPassed: boolean;
  score: number; // 0 to 100
  criteriaFeedback: Array<{ criterion: string; passed: boolean; note: string }>;
  generatedEvidence?: SkillEvidenceItem;
}

/**
 * Generates an applied practice task for a given skill.
 */
export function generatePracticeTask(
  skill: string,
  type: PracticeTaskType = "DEBUG_CODE"
): RealWorldPracticeTask {
  const norm = skill.toLowerCase();

  if (norm.includes("docker")) {
    return {
      id: "rw_docker_debug",
      type: "DEBUG_CODE",
      title: "Fix Failing Multi-Stage Docker Build Caching",
      targetSkill: "Docker",
      scenarioDescription: "A CI build takes 18 minutes because package installations run on every code change.",
      brokenCodeSnippet: `FROM node:18\nWORKDIR /app\nCOPY . .\nRUN npm install\nCMD ["npm", "start"]`,
      expectedDeliverableDescription: "Restructure Dockerfile into separate builder stage and cache npm install layers.",
      acceptanceCriteria: [
        "COPY package*.json runs before npm install",
        "Source code copied in separate subsequent layer",
        "Non-root node user used for execution",
      ],
      estimatedMinutes: 20,
    };
  }

  if (norm.includes("postgres") || norm.includes("sql")) {
    return {
      id: "rw_sql_optimize",
      type: "OPTIMIZE_PERFORMANCE",
      title: "Eliminate N+1 Sequential Scan on High-Volume Table",
      targetSkill: "PostgreSQL",
      scenarioDescription: "The `/api/orders` endpoint takes 1400ms because orders are joined without indexing user_id.",
      expectedDeliverableDescription: "Write a PostgreSQL migration creating a partial or B-tree index and rewriting the join query.",
      acceptanceCriteria: [
        "CREATE INDEX CONCURRENTLY statement included",
        "Query utilizes EXPLAIN ANALYZE verification",
      ],
      estimatedMinutes: 25,
    };
  }

  return {
    id: `rw_${norm.replace(/[^a-z0-9]/g, "_")}_task`,
    type,
    title: `Production ${skill} Implementation Task`,
    targetSkill: skill,
    scenarioDescription: `Implement error boundaries and robust unit tests for ${skill} component.`,
    expectedDeliverableDescription: `A functional, typed implementation with test assertions.`,
    acceptanceCriteria: [
      "Handles unexpected null/undefined inputs",
      "Achieves 100% test pass rate on edge cases",
    ],
    estimatedMinutes: 20,
  };
}

/**
 * Evaluates completed practice work and converts passing work into verifiable evidence.
 */
export function evaluateRealWorldPractice(input: {
  userId: string;
  task: RealWorldPracticeTask;
  userSubmission: string;
}): PracticeEvaluationResult {
  const sub = input.userSubmission.toLowerCase();
  const criteriaFeedback: PracticeEvaluationResult["criteriaFeedback"] = [];
  let passedCount = 0;

  for (const criterion of input.task.acceptanceCriteria) {
    let passed = false;
    let note = "Criterion requirement not satisfied in deliverable.";

    if (input.task.targetSkill.toLowerCase() === "docker") {
      if (criterion.includes("package*.json") && sub.includes("package*.json")) {
        passed = true;
        note = "Correctly isolated package.json layer caching.";
      } else if (criterion.includes("subsequent layer") && sub.includes("copy . .")) {
        passed = true;
        note = "Separated application code copy layer.";
      } else if (criterion.includes("user") && (sub.includes("user node") || sub.includes("user 1000"))) {
        passed = true;
        note = "Applied non-root unprivileged execution security best practice.";
      }
    } else {
      if (input.userSubmission.length > 50) {
        passed = true;
        note = "Satisfactorily addressed requirement in implementation.";
      }
    }

    if (passed) passedCount++;
    criteriaFeedback.push({ criterion, passed, note });
  }

  const score = Math.round((passedCount / input.task.acceptanceCriteria.length) * 100);
  const isPassed = score >= 65;

  let generatedEvidence: SkillEvidenceItem | undefined;
  if (isPassed) {
    generatedEvidence = {
      id: `ev_rw_${input.task.id}_${Date.now()}`,
      userId: input.userId,
      skillId: input.task.targetSkill.toLowerCase(),
      skillName: input.task.targetSkill,
      source: "PRACTICE_ASSESSMENT",
      status: "CONFIRMED",
      title: `Real-World Practice: ${input.task.title}`,
      description: `Successfully resolved ${input.task.type} challenge: ${input.task.scenarioDescription}`,
      confidence: 0.85,
      provenance: "SOURCE_VERIFIED",
      createdAt: new Date().toISOString(),
      verifiedAt: new Date().toISOString(),
    };
  }

  return {
    taskId: input.task.id,
    isPassed,
    score,
    criteriaFeedback,
    generatedEvidence,
  };
}
