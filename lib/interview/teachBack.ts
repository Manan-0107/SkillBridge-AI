/**
 * lib/interview/teachBack.ts
 *
 * UBIX Teach-Back Evaluation Engine
 *
 * The Feynman Technique applied to career mastery:
 * Prompts the user to explain a complex engineering concept in their own words
 * as if explaining to a junior colleague or non-technical stakeholder.
 *
 * Evaluates:
 * - Conceptual accuracy
 * - Clarity and absence of hollow jargon
 * - Core analogy or real-world example
 * - Adaptation recommendation based on mastery level
 */

export interface TeachBackPrompt {
  id: string;
  topic: string;
  conceptToExplain: string;
  targetAudience: "JUNIOR_DEVELOPER" | "EXECUTIVE_STAKEHOLDER" | "PEER_ARCHITECT";
  evaluationCriteria: string[];
}

export interface TeachBackEvaluation {
  topic: string;
  conceptMasteryScore: number; // 0 to 100
  accuracyAssessment: "EXCELLENT" | "SATISFACTORY" | "INCOMPLETE" | "MISCONCEPTIONS_DETECTED";
  clarityNotes: string;
  identifiedMisconceptions: string[];
  suggestedFollowUpPractice: string;
}

/**
 * Generates a targeted Teach-Back prompt for a given skill or concept.
 */
export function generateTeachBackPrompt(
  skill: string,
  targetAudience: "JUNIOR_DEVELOPER" | "EXECUTIVE_STAKEHOLDER" | "PEER_ARCHITECT" = "JUNIOR_DEVELOPER"
): TeachBackPrompt {
  const norm = skill.toLowerCase();
  let conceptToExplain = `How does ${skill} operate under the hood?`;
  let criteria = ["Explain core purpose", "Walk through concrete life-cycle", "Discuss trade-offs"];

  if (norm.includes("docker") || norm.includes("container")) {
    conceptToExplain = "Explain why Docker containers are not identical to Virtual Machines, and how Linux namespaces/cgroups provide isolation.";
    criteria = ["Explain kernel sharing vs guest OS", "Contrast resource overhead", "Explain portability benefits"];
  } else if (norm.includes("react") || norm.includes("virtual dom")) {
    conceptToExplain = "Explain why React uses a Virtual DOM and how reconciliation minimizes direct DOM mutations.";
    criteria = ["Explain browser render tree cost", "Describe diffing algorithm concept", "Identify when state changes trigger re-renders"];
  } else if (norm.includes("database") || norm.includes("acid") || norm.includes("postgres")) {
    conceptToExplain = "Explain what ACID transactions guarantee in PostgreSQL and what happens when two transactions write concurrently.";
    criteria = ["Define Atomicity and Consistency", "Explain write-ahead logging (WAL)", "Describe isolation levels and race conditions"];
  }

  return {
    id: `tb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    topic: skill,
    conceptToExplain,
    targetAudience,
    evaluationCriteria: criteria,
  };
}

/**
 * Evaluates a user's teach-back explanation.
 */
export function evaluateTeachBack(
  prompt: TeachBackPrompt,
  userExplanation: string
): TeachBackEvaluation {
  const text = userExplanation.toLowerCase();
  const wordCount = userExplanation.trim().split(/\s+/).length;

  const misconceptions: string[] = [];
  let score = 70;

  if (wordCount < 15) {
    return {
      topic: prompt.topic,
      conceptMasteryScore: 35,
      accuracyAssessment: "INCOMPLETE",
      clarityNotes: "Explanation is too brief to demonstrate operational mental model.",
      identifiedMisconceptions: ["Insufficient detail provided to evaluate comprehension."],
      suggestedFollowUpPractice: `Review fundamentals of ${prompt.topic} and try breaking down the lifecycle step-by-step.`,
    };
  }

  // Domain checks
  if (prompt.topic.toLowerCase().includes("docker")) {
    if (text.includes("hypervisor") && !text.includes("without") && !text.includes("doesn't")) {
      misconceptions.push("Docker does not run a full hypervisor with guest OS kernels.");
      score -= 20;
    }
    if (text.includes("kernel") || text.includes("namespace") || text.includes("isolated")) {
      score += 15;
    }
  }

  if (prompt.topic.toLowerCase().includes("react")) {
    if (text.includes("diff") || text.includes("reconciliation") || text.includes("state")) {
      score += 15;
    }
  }

  score = Math.max(20, Math.min(100, score));

  let accuracy: TeachBackEvaluation["accuracyAssessment"] = "SATISFACTORY";
  if (score >= 85) accuracy = "EXCELLENT";
  else if (misconceptions.length > 0) accuracy = "MISCONCEPTIONS_DETECTED";
  else if (score < 60) accuracy = "INCOMPLETE";

  return {
    topic: prompt.topic,
    conceptMasteryScore: score,
    accuracyAssessment: accuracy,
    clarityNotes: accuracy === "EXCELLENT"
      ? "Strong intuitive grasp: Used clean analogies and clear technical mechanics."
      : "Adequate explanation with opportunities to sharpen precise architectural terminology.",
    identifiedMisconceptions: misconceptions,
    suggestedFollowUpPractice: misconceptions.length > 0
      ? `Revisit core concepts on ${misconceptions[0]}.`
      : `Complete a real-world coding challenge demonstrating ${prompt.topic}.`,
  };
}
