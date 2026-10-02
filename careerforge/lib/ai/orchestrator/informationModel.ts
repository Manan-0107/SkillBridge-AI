/**
 * lib/ai/orchestrator/informationModel.ts
 *
 * UBIX Generic Information Requirement Model:
 * Defines composable, runtime-evaluable information requirements.
 * Replaces hardcoded static question lists with dynamic requirement resolution.
 */

export type ResolutionStatus =
  | "KNOWN"
  | "UNKNOWN"
  | "SKIPPED"
  | "AMBIGUOUS"
  | "OUTDATED"
  | "LOW_CONFIDENCE"
  | "CONFIRMED";

export type RequirementImportance = "critical" | "high" | "medium" | "optional";

export type InformationSource =
  | "user_input"
  | "profile"
  | "inferred"
  | "previous_conversation"
  | "resume"
  | "practice_history"
  | "default";

export interface InformationRequirement<T = any> {
  key: string;
  description: string;
  importance: RequirementImportance;
  requiredFor: string[]; // task IDs, e.g. ["generate_roadmap", "build_resume"]
  dependencies: string[]; // keys that should ideally be known before asking this (e.g. ["targetRole"])
  status: ResolutionStatus;
  currentValue?: T;
  source?: InformationSource;
  confidence: number; // 0.0 - 1.0
  ambiguityReason?: string;
  updatedAt?: number;
  skipAllowed?: boolean;
  confirmationRequired?: boolean;
}

export interface InformationResolutionContext {
  currentPage?: string;
  currentTask?: string;
  userProfile?: {
    name?: string | null;
    email?: string | null;
    targetRole?: string | null;
    experienceLevel?: string | null;
    skills?: string[];
    weakSkills?: string[];
    missingSkills?: string[];
    location?: string | null;
    availableLearningHours?: number | null;
    learningGoal?: string | null;
  };
  knownInformation?: Record<string, any>;
  conversationHistory?: Array<{ role: string; text: string; timestamp?: number }>;
  previousAnswers?: Record<string, any>;
  userPreferences?: Record<string, any>;
  practiceHistory?: {
    weakTopics?: string[];
    strongTopics?: string[];
    recentScores?: Record<string, number>;
    struggledConcepts?: string[];
  };
  language?: string;
  accessibilityPreferences?: Record<string, any>;
}

/**
 * Evaluates whether an information requirement is considered resolved with high confidence.
 */
export function isRequirementResolved(req: InformationRequirement): boolean {
  if (req.status === "SKIPPED") {
    return true; // Explicitly skipped fields are resolved to prevent repeated prompts
  }
  if (req.status === "UNKNOWN" && req.source === "default") {
    return true; // Uncertainty resolved with default baseline assumption
  }
  if (req.status === "KNOWN" || req.status === "CONFIRMED") {
    return req.currentValue !== undefined && req.currentValue !== null && req.currentValue !== "";
  }
  return false;
}

/**
 * Evaluates a requirement given the runtime context.
 */
export function evaluateRequirementStatus(
  req: InformationRequirement,
  context: InformationResolutionContext
): InformationRequirement {
  const profile = context.userProfile || {};
  const known = context.knownInformation || {};
  const prevAnswers = context.previousAnswers || {};

  // Check if requirement is explicitly flagged as ambiguous
  if (context.knownInformation?._ambiguousFields?.[req.key]) {
    return {
      ...req,
      currentValue: known[req.key],
      status: "AMBIGUOUS",
      ambiguityReason: context.knownInformation._ambiguousFields[req.key],
      confidence: 0.5,
      source: "user_input",
    };
  }

  // Check direct known overrides first
  if (known[req.key] !== undefined && known[req.key] !== null) {
    if (known[req.key] === "__SKIPPED__") {
      return {
        ...req,
        currentValue: null,
        status: "SKIPPED",
        confidence: 0,
        source: "user_input",
      };
    }
    if (known[req.key] === "__DONT_KNOW__") {
      return {
        ...req,
        currentValue: null,
        status: "UNKNOWN",
        confidence: 0,
        source: "default",
      };
    }
    return {
      ...req,
      currentValue: known[req.key],
      status: "KNOWN",
      confidence: 0.95,
      source: "previous_conversation",
    };
  }

  // Check previously collected answers in this or prior session
  if (prevAnswers[req.key] !== undefined && prevAnswers[req.key] !== null) {
    return {
      ...req,
      currentValue: prevAnswers[req.key],
      status: "KNOWN",
      confidence: 0.9,
      source: "previous_conversation",
    };
  }

  // Check user profile fields (including aliases)
  let profileVal = (profile as any)[req.key];
  if (profileVal === undefined || profileVal === null || profileVal === "") {
    if (req.key === "availableLearningTime") {
      profileVal = profile.availableLearningHours;
    } else if (req.key === "fullName") {
      profileVal = profile.name;
    }
  }

  if (profileVal !== undefined && profileVal !== null && profileVal !== "") {
    if (Array.isArray(profileVal) && profileVal.length === 0) {
      // Empty array is considered unknown
    } else {
      return {
        ...req,
        currentValue: profileVal,
        status: "KNOWN",
        confidence: 1.0,
        source: "profile",
      };
    }
  }

  // Check if value is ambiguous or low confidence
  if (req.currentValue !== undefined && req.confidence < 0.6) {
    return {
      ...req,
      status: "LOW_CONFIDENCE",
    };
  }

  return {
    ...req,
    status: req.currentValue !== undefined ? req.status : "UNKNOWN",
  };
}
