/**
 * lib/ai/orchestrator/adaptiveAssessment.ts
 *
 * UBIX Dynamic Adaptive Assessment Engine:
 * Assessment questions are dynamically generated based on runtime mastery:
 * Current ability + previous answer + confidence + mistakes + topic + difficulty = NEXT QUESTION.
 * Owns: score, question number, difficulty, topic, completion.
 */

export type AssessmentDifficulty = "fundamental" | "intermediate" | "advanced" | "mastery";

export interface AssessmentState {
  sessionId: string;
  topic: string;
  currentDifficulty: AssessmentDifficulty;
  questionNumber: number;
  maxQuestions: number;
  score: number;
  consecutiveCorrect: number;
  consecutiveIncorrect: number;
  knowledgeGaps: string[];
  masteredConcepts: string[];
  history: Array<{
    question: string;
    userAnswer: string;
    evaluation: "correct" | "partial" | "incorrect" | "dont_know";
    difficulty: AssessmentDifficulty;
    subconcept: string;
  }>;
  completed: boolean;
}

export interface AdaptiveQuestion {
  questionText: string;
  subconcept: string;
  difficulty: AssessmentDifficulty;
  questionNumber: number;
  probingUnderlyingConcept?: boolean;
}

export class AdaptiveAssessmentEngine {
  public static createSession(topic: string, initialDifficulty: AssessmentDifficulty = "fundamental"): AssessmentState {
    return {
      sessionId: `assess_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      topic,
      currentDifficulty: initialDifficulty,
      questionNumber: 1,
      maxQuestions: 5,
      score: 0,
      consecutiveCorrect: 0,
      consecutiveIncorrect: 0,
      knowledgeGaps: [],
      masteredConcepts: [],
      history: [],
      completed: false,
    };
  }

  /**
   * Processes the user's answer and adapts difficulty and next concept inquiry.
   */
  public static recordTurn(
    state: AssessmentState,
    question: AdaptiveQuestion,
    userAnswer: string,
    evaluation: "correct" | "partial" | "incorrect" | "dont_know"
  ): { nextState: AssessmentState; nextQuestion: AdaptiveQuestion | null; feedback: string } {
    const updated = { ...state };
    updated.history = [
      ...updated.history,
      {
        question: question.questionText,
        userAnswer,
        evaluation,
        difficulty: question.difficulty,
        subconcept: question.subconcept,
      },
    ];

    let feedback = "";

    switch (evaluation) {
      case "correct":
        updated.score += question.difficulty === "mastery" ? 25 : question.difficulty === "advanced" ? 20 : 15;
        updated.consecutiveCorrect += 1;
        updated.consecutiveIncorrect = 0;
        if (!updated.masteredConcepts.includes(question.subconcept)) {
          updated.masteredConcepts.push(question.subconcept);
        }
        feedback = "Excellent! You explained that clearly.";
        break;

      case "partial":
        updated.score += 8;
        feedback = "You're on the right track, with one detail to clarify.";
        break;

      case "incorrect":
        updated.consecutiveIncorrect += 1;
        updated.consecutiveCorrect = 0;
        if (!updated.knowledgeGaps.includes(question.subconcept)) {
          updated.knowledgeGaps.push(question.subconcept);
        }
        feedback = `Let's break down ${question.subconcept} to strengthen that fundamental.`;
        break;

      case "dont_know":
        updated.consecutiveIncorrect += 1;
        updated.consecutiveCorrect = 0;
        if (!updated.knowledgeGaps.includes(question.subconcept)) {
          updated.knowledgeGaps.push(question.subconcept);
        }
        feedback = "No problem at all! Noting this as an area to explore together.";
        break;
    }

    // ── Dynamic Difficulty Adjustment ──
    if (updated.consecutiveCorrect >= 2) {
      if (updated.currentDifficulty === "fundamental") updated.currentDifficulty = "intermediate";
      else if (updated.currentDifficulty === "intermediate") updated.currentDifficulty = "advanced";
      else if (updated.currentDifficulty === "advanced") updated.currentDifficulty = "mastery";
      updated.consecutiveCorrect = 0;
    } else if (updated.consecutiveIncorrect >= 2 || evaluation === "dont_know") {
      if (updated.currentDifficulty === "mastery") updated.currentDifficulty = "advanced";
      else if (updated.currentDifficulty === "advanced") updated.currentDifficulty = "intermediate";
      else if (updated.currentDifficulty === "intermediate") updated.currentDifficulty = "fundamental";
      updated.consecutiveIncorrect = 0;
    }

    updated.questionNumber += 1;

    // Check completion condition
    if (updated.questionNumber > updated.maxQuestions) {
      updated.completed = true;
      return {
        nextState: updated,
        nextQuestion: null,
        feedback: `${feedback} You've completed this adaptive drill! Mastery Score: ${updated.score}/100.`,
      };
    }

    // Generate next adaptive question
    const nextQ = this.generateNextQuestion(updated, evaluation, question.subconcept);
    return {
      nextState: updated,
      nextQuestion: nextQ,
      feedback,
    };
  }

  /**
   * Dynamically constructs next question based on user trajectory.
   */
  private static generateNextQuestion(
    state: AssessmentState,
    lastEvaluation: "correct" | "partial" | "incorrect" | "dont_know",
    lastSubconcept: string
  ): AdaptiveQuestion {
    const topic = state.topic.toLowerCase();
    const diff = state.currentDifficulty;

    // If user struggled repeatedly with recursion, probe underlying call stack concept
    if ((lastEvaluation === "incorrect" || lastEvaluation === "dont_know") && topic.includes("recursion")) {
      return {
        questionText: "Before continuing: in your own words, what happens to the call stack during each recursive call before hitting the base case?",
        subconcept: "call stack mechanics",
        difficulty: "fundamental",
        questionNumber: state.questionNumber,
        probingUnderlyingConcept: true,
      };
    }

    // If user answered partially, ask a targeted follow-up on that specific subconcept
    if (lastEvaluation === "partial") {
      return {
        questionText: `Building on your point about ${lastSubconcept}: how would you prevent memory overhead or stack overflow in that scenario?`,
        subconcept: `${lastSubconcept} optimization`,
        difficulty: diff,
        questionNumber: state.questionNumber,
      };
    }

    // Standard progression based on dynamic difficulty tier
    const subconcepts: Record<string, Record<AssessmentDifficulty, string>> = {
      recursion: {
        fundamental: "base case and call stack termination",
        intermediate: "tail recursion vs head recursion",
        advanced: "memoization and recursive time complexity",
        mastery: "tree traversal recursion with backtracking",
      },
      react: {
        fundamental: "state vs props and component lifecycle",
        intermediate: "useEffect dependency arrays and cleanup",
        advanced: "useMemo, useCallback, and re-render prevention",
        mastery: "custom hooks with complex asynchronous state machines",
      },
      python: {
        fundamental: "lists, dictionaries, and mutability",
        intermediate: "list comprehensions, generators, and iterators",
        advanced: "decorators and context managers",
        mastery: "metaclasses and asyncio event loops",
      },
    };

    const conceptMap = subconcepts[topic] || {
      fundamental: "core syntax and fundamentals",
      intermediate: "practical application and error handling",
      advanced: "performance and architecture",
      mastery: "production design patterns and edge cases",
    };

    const targetSubconcept = conceptMap[diff];
    return {
      questionText: `[${diff.toUpperCase()}] Could you explain how ${targetSubconcept} works in ${state.topic}, and when you would use it?`,
      subconcept: targetSubconcept,
      difficulty: diff,
      questionNumber: state.questionNumber,
    };
  }
}
