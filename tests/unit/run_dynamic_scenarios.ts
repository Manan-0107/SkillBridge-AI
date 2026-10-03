import assert from "node:assert/strict";
import {
  DynamicQuestionOrchestrator,
  AdaptiveAssessmentEngine,
  TASK_REGISTRY,
  extractFromUtterance,
} from "../../lib/ai/orchestrator";

export function runAllScenarios() {
  const results: Record<string, boolean> = {};

  // =========================================================================
  // SCENARIO 1: Two users enter Roadmap with different profiles -> Different questions
  // =========================================================================
  // User A has target role, but no available time or experience level
  const userAContext = {
    currentPage: "roadmap",
    userProfile: {
      name: "Alice",
      targetRole: "Software Developer",
      skills: ["JavaScript", "HTML", "CSS"],
      experienceLevel: "Beginner",
    },
    knownInformation: {
      targetRole: "Software Developer",
      experienceLevel: "Beginner",
    },
  };
  const decisionA = DynamicQuestionOrchestrator.evaluateNextStep(userAContext, "Make me a roadmap");
  assert.equal(decisionA.shouldAsk, true);
  assert.equal(decisionA.nextRequirementToAsk?.key, "availableLearningTime");
  assert(
    decisionA.phrasedQuestion?.includes("hours") || decisionA.phrasedQuestion?.includes("time"),
    "User A must be asked for available learning time"
  );

  // User B switches from Java backend to frontend; already knows experience & target direction
  const userBContext = {
    currentPage: "roadmap",
    userProfile: {
      name: "Bob",
      targetRole: "Frontend Developer",
      skills: ["Java", "Spring Boot"],
      experienceLevel: "Career Switcher",
      learningGoal: "Switch from Java backend to frontend",
    },
    knownInformation: {
      targetRole: "Frontend Developer",
      experienceLevel: "Career Switcher",
      isCareerSwitcher: true,
      availableLearningTime: 15,
    },
  };
  const decisionB = DynamicQuestionOrchestrator.evaluateNextStep(userBContext, "Make me a roadmap");
  // For Bob, targetRole, experience, and available time are known, so different question or execution
  assert.notEqual(
    decisionA.phrasedQuestion,
    decisionB.phrasedQuestion,
    "User A and User B must receive different questions"
  );
  results["Scenario 1: Profile-Driven Dynamic Questions"] = true;

  // =========================================================================
  // SCENARIO 2: Same user enters Roadmap twice -> Second visit does not repeat known questions
  // =========================================================================
  const repeatUserVisit1 = {
    currentPage: "roadmap",
    userProfile: {
      name: "Carol",
      targetRole: "Data Scientist",
    },
    knownInformation: {
      targetRole: "Data Scientist",
    },
  };
  const visit1Decision = DynamicQuestionOrchestrator.evaluateNextStep(repeatUserVisit1, "Make me a roadmap");
  assert.equal(visit1Decision.shouldAsk, true);

  // Second visit: User previously answered learning time (e.g. 10 hours) and experience
  const repeatUserVisit2 = {
    currentPage: "roadmap",
    userProfile: {
      name: "Carol",
      targetRole: "Data Scientist",
      availableLearningHours: 10,
      experienceLevel: "Intermediate",
    },
    knownInformation: {
      targetRole: "Data Scientist",
      availableLearningTime: 10,
      experienceLevel: "Intermediate",
    },
  };
  const visit2Decision = DynamicQuestionOrchestrator.evaluateNextStep(repeatUserVisit2, "Make me a roadmap");
  assert.equal(visit2Decision.shouldAsk, false, "Second visit must not ask questions when all info is known");
  assert.equal(visit2Decision.canExecuteTask, true);
  results["Scenario 2: Memory & Non-Repetition"] = true;

  // =========================================================================
  // SCENARIO 3: User provides multiple pieces of information in one sentence
  // =========================================================================
  const multiFieldUtterance =
    "Create a roadmap for becoming a Python backend developer. I'm a beginner and can study 2 hours every evening.";
  const multiContext = {
    currentPage: "roadmap",
    knownInformation: {},
  };
  const multiDecision = DynamicQuestionOrchestrator.evaluateNextStep(multiContext, multiFieldUtterance);
  assert.equal(multiDecision.extractedData.targetRole, "Backend Developer");
  assert.equal(multiDecision.extractedData.experienceLevel, "Beginner");
  assert.equal(multiDecision.extractedData.availableLearningTime, 14); // 2 hrs * 7 days
  assert.equal(multiDecision.shouldAsk, false, "All requirements extracted in one shot; should execute directly");
  assert.equal(multiDecision.canExecuteTask, true);
  results["Scenario 3: Multi-Field Single-Utterance Extraction"] = true;

  // =========================================================================
  // SCENARIO 4: User changes task mid-conversation
  // =========================================================================
  const inRoadmapTaskContext = {
    currentPage: "roadmap",
    currentTask: "generate_roadmap",
    knownInformation: {
      activePromptKey: "availableLearningTime",
    },
  };
  const switchUtterance = "Actually forget the roadmap. Find me jobs.";
  const switchDecision = DynamicQuestionOrchestrator.evaluateNextStep(inRoadmapTaskContext, switchUtterance);
  assert.equal(switchDecision.taskSwitched, true);
  assert.equal(switchDecision.activeTaskId, "find_jobs");
  results["Scenario 4: Conversational Task-Switching"] = true;

  // =========================================================================
  // SCENARIO 5: User gives ambiguous information -> Clarification requested
  // =========================================================================
  const ambiguousContext = {
    currentPage: "roadmap",
    userProfile: {
      targetRole: "Frontend Developer",
    },
    knownInformation: {
      targetRole: "Frontend Developer",
      activePromptKey: "availableLearningTime",
    },
  };
  const ambiguousDecision = DynamicQuestionOrchestrator.evaluateNextStep(ambiguousContext, "I can study a few hours");
  assert.equal(ambiguousDecision.confirmationRequired, true);
  assert(
    ambiguousDecision.phrasedQuestion?.includes("When you say a few hours") ||
      ambiguousDecision.phrasedQuestion?.includes("3 to 5 hours"),
    "Must ask clarification for ambiguous hours"
  );
  results["Scenario 5: Dynamic Ambiguity Clarification"] = true;

  // =========================================================================
  // SCENARIO 6: User speaks Hindi -> Natural Hindi question
  // =========================================================================
  const hindiContext = {
    currentPage: "roadmap",
    language: "hi",
    userProfile: {
      targetRole: "Software Developer",
    },
    knownInformation: {
      targetRole: "Software Developer",
    },
  };
  const hindiDecision = DynamicQuestionOrchestrator.evaluateNextStep(hindiContext, "मुझे रोडमैप चाहिए");
  assert.equal(hindiDecision.shouldAsk, true);
  assert(
    /[\u0900-\u097F]/.test(hindiDecision.phrasedQuestion || ""),
    "Hindi query must generate Hindi question phrasing in Devanagari"
  );
  results["Scenario 6: Natural Hindi Response"] = true;

  // =========================================================================
  // SCENARIO 7: User speaks Gujarati -> Natural Gujarati question
  // =========================================================================
  const gujaratiContext = {
    currentPage: "roadmap",
    language: "gu",
    userProfile: {
      targetRole: "Frontend Developer",
    },
    knownInformation: {
      targetRole: "Frontend Developer",
    },
  };
  const gujaratiDecision = DynamicQuestionOrchestrator.evaluateNextStep(
    gujaratiContext,
    "મારે ફ્રન્ટએન્ડ ડેવલપર બનવું છે"
  );
  assert.equal(gujaratiDecision.shouldAsk, true);
  assert(
    /[\u0A80-\u0AFF]/.test(gujaratiDecision.phrasedQuestion || ""),
    "Gujarati query must generate Gujarati question phrasing in Gujarati script"
  );
  results["Scenario 7: Natural Gujarati Response"] = true;

  // =========================================================================
  // SCENARIO 8: User mixes English and Hindi/Gujarati (code-switching)
  // =========================================================================
  const hinglishExtraction = extractFromUtterance("Har week realistically 10 hours learning ke liye de sakta hu");
  assert.equal(hinglishExtraction.extractedFields.availableLearningTime, 10);
  assert(
    hinglishExtraction.detectedLanguage === "hi" || hinglishExtraction.detectedLanguage === "hinglish",
    "Must detect Indic code-switching"
  );
  results["Scenario 8: Multilingual Code-Switching"] = true;

  // =========================================================================
  // SCENARIO 9: User's existing progress indicates weakness -> Practice adapts
  // =========================================================================
  const practiceWeaknessContext = {
    currentPage: "practice",
    currentTask: "start_practice",
    practiceHistory: {
      struggledConcepts: ["Java recursion"],
    },
    knownInformation: {},
  };
  const weaknessDecision = DynamicQuestionOrchestrator.evaluateNextStep(
    practiceWeaknessContext,
    "I keep getting Java recursion questions wrong"
  );
  assert(
    weaknessDecision.phrasedQuestion?.includes("Java recursion"),
    "Adaptive practice must probe the specific struggling concept"
  );
  results["Scenario 9: Adaptive Weakness Probing"] = true;

  // =========================================================================
  // SCENARIO 10: User says "Skip" -> Advances safely without breaking task
  // =========================================================================
  const skipContext = {
    currentPage: "roadmap",
    currentTask: "generate_roadmap",
    knownInformation: {
      targetRole: "Full Stack Developer",
      activePromptKey: "availableLearningTime",
    },
  };
  const skipDecision = DynamicQuestionOrchestrator.evaluateNextStep(skipContext, "Skip this");
  assert.equal(skipDecision.updatedContext.knownInformation?.availableLearningTime, null);
  assert.equal(skipDecision.updatedContext.knownInformation?._fieldStatuses?.availableLearningTime, "SKIPPED");
  assert.equal(skipDecision.canExecuteTask, true, "Skipping non-critical requirement allows execution");
  results["Scenario 10: Graceful Requirement Skip"] = true;

  // =========================================================================
  // SCENARIO 11: User says "I don't know" -> Stores uncertain state and continues
  // =========================================================================
  const dontKnowContext = {
    currentPage: "roadmap",
    currentTask: "generate_roadmap",
    knownInformation: {
      targetRole: "DevOps Engineer",
      activePromptKey: "experienceLevel",
    },
  };
  const dontKnowDecision = DynamicQuestionOrchestrator.evaluateNextStep(dontKnowContext, "I don't know");
  assert.equal(dontKnowDecision.updatedContext.knownInformation?.experienceLevel, null);
  assert.equal(dontKnowDecision.updatedContext.knownInformation?._fieldStatuses?.experienceLevel, "UNKNOWN");
  results["Scenario 11: Uncertain Knowledge Handling"] = true;

  // =========================================================================
  // SCENARIO 12: User says "Actually, find jobs instead" -> Immediate task change
  // =========================================================================
  const jobSwitchContext = {
    currentPage: "assistant",
    currentTask: "generate_roadmap",
    knownInformation: {
      activePromptKey: "availableLearningTime",
    },
  };
  const jobSwitchDecision = DynamicQuestionOrchestrator.evaluateNextStep(
    jobSwitchContext,
    "Actually, find jobs instead"
  );
  assert.equal(jobSwitchDecision.taskSwitched, true);
  assert.equal(jobSwitchDecision.activeTaskId, "find_jobs");
  results["Scenario 12: Immediate Task Redirect"] = true;

  // =========================================================================
  // Dynamic Adaptive Assessment Engine Validation
  // =========================================================================
  const assessState = AdaptiveAssessmentEngine.createSession("Recursion", "fundamental");
  const turn1 = AdaptiveAssessmentEngine.recordTurn(
    assessState,
    {
      questionText: "What is the base case in a recursive function?",
      subconcept: "Base Case",
      difficulty: "fundamental",
      questionNumber: 1,
    },
    "It stops the recursion from continuing indefinitely",
    "correct"
  );
  assert.equal(turn1.nextState.score, 15);
  assert.equal(turn1.nextState.consecutiveCorrect, 1);
  assert(turn1.nextQuestion !== null);
  results["Adaptive Assessment: Dynamic Difficulty & Flow"] = true;

  return results;
}

if (process.argv[1]?.endsWith("run_dynamic_scenarios.ts")) {
  const res = runAllScenarios();
  console.log(JSON.stringify({ status: "ok", results: res }, null, 2));
}
