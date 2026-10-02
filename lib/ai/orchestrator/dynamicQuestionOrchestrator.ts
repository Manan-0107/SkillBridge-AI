/**
 * lib/ai/orchestrator/dynamicQuestionOrchestrator.ts
 *
 * UBIX Dynamic Question Orchestrator:
 * Central reasoning coordinator for conversation-driven career workflows.
 *
 * Core Responsibility:
 * "Given everything UBIX currently knows, what is the single most useful piece of information to ask for next?"
 *
 * Implements:
 * - Runtime requirement discovery without static question lists
 * - Dependency and adaptive priority ranking
 * - Multi-field extraction and natural conversation
 * - Contextual memory across sessions and profiles
 * - Multilingual conversational phrasing (English, Hindi, Gujarati, Hinglish)
 * - Safe application boundary: LLM proposes, application executes
 */

import {
  InformationRequirement,
  InformationResolutionContext,
  evaluateRequirementStatus,
  isRequirementResolved,
} from "./informationModel";
import { TASK_REGISTRY, TaskId } from "./taskRequirements";
import { resolvePageCapability, PAGE_CAPABILITIES } from "./pageCapabilities";
import { extractFromUtterance, ExtractionResult } from "./dynamicExtractor";

export interface OrchestrationDecision {
  shouldAsk: boolean;
  activeTaskId: TaskId;
  taskName: string;
  missingRequirements: InformationRequirement[];
  nextRequirementToAsk: InformationRequirement | null;
  phrasedQuestion: string | null;
  confirmationRequired: boolean;
  canExecuteTask: boolean;
  actionToExecute: string | null;
  taskSwitched: boolean;
  situationalNotice?: string;
  extractedData: Record<string, any>;
  updatedContext: InformationResolutionContext;
}

export class DynamicQuestionOrchestrator {
  /**
   * Main Orchestration Evaluation
   */
  public static evaluateNextStep(
    context: InformationResolutionContext,
    userUtterance: string = ""
  ): OrchestrationDecision {
    let activeTask: TaskId = (context.currentTask as TaskId) || "general_inquiry";
    let taskSwitched = false;
    let situationalNotice: string | undefined;

    // ── 1. Page Context Resolution ──
    const pageCap = resolvePageCapability(context.currentPage || "assistant");
    if (!context.currentTask && pageCap.defaultTaskId) {
      activeTask = pageCap.defaultTaskId;
      // First visit for completely new user: initiate onboarding
      if (
        activeTask === "general_inquiry" &&
        !context.userProfile?.targetRole &&
        !context.knownInformation?.targetRole
      ) {
        activeTask = "onboarding";
      }
    }

    // ── 2. User Utterance Extraction & Multi-Field Resolution ──
    const extraction: ExtractionResult = extractFromUtterance(userUtterance, activeTask);

    // Check Task-Switching Intent
    if (extraction.taskSwitchTo && extraction.taskSwitchTo !== activeTask) {
      activeTask = extraction.taskSwitchTo;
      taskSwitched = true;
      situationalNotice = `Switched focus to ${TASK_REGISTRY[activeTask].name}.`;
    }

    // Merge extracted fields into working knowledge context
    const updatedKnown: Record<string, any> = {
      ...(context.knownInformation || {}),
      ...(extraction.extractedFields || {}),
      _ambiguousFields: {
        ...(context.knownInformation?._ambiguousFields || {}),
        ...extraction.ambiguousFields,
      },
    };

    // If user skipped, mark the active requirement as skipped
    if (extraction.isSkip && context.knownInformation?.activePromptKey) {
      updatedKnown[context.knownInformation.activePromptKey] = "__SKIPPED__";
    }

    // If user said "I don't know", mark as uncertain
    if (extraction.isUnknownOrDontKnow && context.knownInformation?.activePromptKey) {
      updatedKnown[context.knownInformation.activePromptKey] = "__DONT_KNOW__";
    }

    const resolvedLang = extraction.detectedLanguage || context.language || "en";

    const updatedContext: InformationResolutionContext = {
      ...context,
      currentTask: activeTask,
      knownInformation: updatedKnown,
      language: resolvedLang,
    };

    // ── Check Intent: Natural Interruption ──
    if (extraction.isInterruption) {
      delete updatedKnown.activePromptKey;
      return {
        shouldAsk: true,
        activeTaskId: "general_inquiry",
        taskName: "General Inquiry",
        missingRequirements: [],
        nextRequirementToAsk: null,
        phrasedQuestion: "Of course! What would you like to ask or explore instead?",
        confirmationRequired: false,
        canExecuteTask: false,
        actionToExecute: null,
        taskSwitched: true,
        situationalNotice: "Interrupted previous flow.",
        extractedData: extraction.extractedFields,
        updatedContext: {
          ...updatedContext,
          currentTask: "general_inquiry",
          knownInformation: updatedKnown,
        },
      };
    }

    // ── Check Intent: Contextual Help Request ──
    if (extraction.isHelpRequest) {
      const pageKey = (context.currentPage || "assistant").toLowerCase();
      const cap = PAGE_CAPABILITIES[pageKey] || PAGE_CAPABILITIES.assistant;
      const isHindi = resolvedLang.startsWith("hi") || resolvedLang === "hinglish";
      const isGujarati = resolvedLang.startsWith("gu") || resolvedLang === "gujlish";

      let helpMsg = `You are in ${cap.workspace.charAt(0).toUpperCase() + cap.workspace.slice(1)}. I can help you with: ${cap.availableActions.join(", ")}. What would you like to do?`;
      if (isHindi) {
        helpMsg = `आप ${cap.workspace} में हैं। मैं आपकी निम्नलिखित में मदद कर सकता हूँ: ${cap.availableActions.join(", ")}। आप क्या करना चाहते हैं?`;
      } else if (isGujarati) {
        helpMsg = `તમે ${cap.workspace}માં છો. હું તમને આ બાબતોમાં મદદ કરી શકું છું: ${cap.availableActions.join(", ")}. તમે શું કરવા માંગો છો?`;
      }

      return {
        shouldAsk: true,
        activeTaskId: activeTask,
        taskName: TASK_REGISTRY[activeTask]?.name || "Assistant",
        missingRequirements: [],
        nextRequirementToAsk: null,
        phrasedQuestion: helpMsg,
        confirmationRequired: false,
        canExecuteTask: false,
        actionToExecute: null,
        taskSwitched: false,
        situationalNotice: helpMsg,
        extractedData: extraction.extractedFields,
        updatedContext,
      };
    }

    // ── 3. Dynamic Task Requirements Resolution ──
    const taskDef = TASK_REGISTRY[activeTask] || TASK_REGISTRY.general_inquiry;
    const declaredReqs = taskDef.resolveRequirements(updatedContext);

    // Evaluate each requirement against current profile, session history, and extracted data
    const evaluatedReqs = declaredReqs.map((req) => evaluateRequirementStatus(req, updatedContext));

    // Filter to missing or unresolved requirements
    const unresolvedReqs = evaluatedReqs.filter((req) => !isRequirementResolved(req));

    // ── Check Intent: "Why do you need to know that?" ──
    if (extraction.isWhyQuestion) {
      const activeKey = context.knownInformation?.activePromptKey || unresolvedReqs[0]?.key || "availableLearningTime";
      const explanations: Record<string, { en: string; hi: string; gu: string }> = {
        availableLearningTime: {
          en: "I need your available study time so I can make the roadmap fit your schedule and pace each milestone realistically.",
          hi: "मुझे आपके अध्ययन के समय की आवश्यकता है ताकि मैं रोडमैप को आपके शेड्यूल के अनुसार तैयार कर सकूं।",
          gu: "મને તમારા ઉપલબ્ધ અભ્યાસ સમયની જરૂર છે જેથી હું રોડમેપને તમારા સમયપત્રક મુજબ ગોઠવી શકું.",
        },
        targetRole: {
          en: "Knowing your target role allows me to select the exact core competencies, technologies, and projects you need to reach job readiness.",
          hi: "आपके लक्षित रोल को जानने से मुझे उन मुख्य कौशलों और प्रोजेक्ट्स को चुनने में मदद मिलती है जो आपको नौकरी के लिए तैयार करेंगे।",
          gu: "તમારો લક્ષિત રોલ જાણીને હું તે મુખ્ય સ્કિલ્સ અને પ્રોજેક્ટ્સ પસંદ કરી શકું જે તમને જોબ માટે તૈયાર કરે.",
        },
        experienceLevel: {
          en: "Knowing your experience level helps me calibrate the depth of the roadmap—skipping basics if you're experienced, or starting from fundamentals if you're new.",
          hi: "आपके अनुभव स्तर को जानने से रोडमैप की गहराई तय करने में मदद मिलती है ताकि शुरुआती या उन्नत स्तर ठीक से सेट हो सके।",
          gu: "તમારા અનુભવ સ્તરથી મને રોડમેપનું સ્તર નક્કી કરવામાં મદદ મળે છે જેથી બેઝિક્સ કે એડવાન્સ ટોપિક યોગ્ય રીતે સેટ થાય.",
        },
        skills: {
          en: "Knowing what you already know ensures we skip concepts you've mastered and focus purely on your skill gaps.",
          hi: "आप पहले से क्या जानते हैं यह जानने से हम उन कौशलों को छोड़ सकते हैं जो आपको पहले से आते हैं।",
          gu: "તમને પહેલેથી શું આવડે છે તે જાણીને આપણે તે વિષયો છોડી શકીએ અને બાકીની સ્કિલ્સ પર ધ્યાન આપી શકીએ.",
        },
        location: {
          en: "Knowing your location ensures I only recommend opportunities and jobs that match your commuting or relocation preferences.",
          hi: "आपके स्थान को जानने से मैं केवल वही नौकरियां सुझाऊंगा जो आपकी पसंद के अनुकूल हों।",
          gu: "તમારું લોકેશન જાણીને હું ફક્ત તે જ નોકરીઓ બતાવીશ જે તમારા વિસ્તાર કે પસંદગી મુજબ હોય.",
        },
        workMode: {
          en: "Knowing whether you prefer remote, hybrid, or onsite work lets me filter out jobs that don't match your lifestyle.",
          hi: "रिमोट या ऑनसाइट काम की पसंद जानने से हम केवल सही नौकरियों को फ़िल्टर कर सकते हैं।",
          gu: "રિમોટ કે ઓનસાઇટ કામની પસંદગી જાણીને આપણે યોગ્ય જોબ્સ જ ફિલ્ટર કરી શકીએ.",
        },
        practiceTopic: {
          en: "Specifying a practice topic allows me to generate tailored coding drills and mock interview questions on the exact concepts you want to test.",
          hi: "प्रैक्टिस टॉपिक तय करने से मुझे उसी विषय पर मॉक इंटरव्यू और कोडिंग प्रश्न तैयार करने में मदद मिलती है।",
          gu: "પ્રેક્ટિસ ટોપિક નક્કી કરવાથી મને તે જ વિષય પર મોક ઇન્ટરવ્યુ અને પ્રશ્નો પૂછવામાં મદદ મળે છે.",
        },
      };

      const isHindi = resolvedLang.startsWith("hi") || resolvedLang === "hinglish";
      const isGujarati = resolvedLang.startsWith("gu") || resolvedLang === "gujlish";
      const explObj = explanations[activeKey] || {
        en: "I ask for this so I can tailor CareerForge specifically to your current career goals and avoid generic advice.",
        hi: "मैं यह इसलिए पूछ रहा हूँ ताकि करियरफ़ोर्ज को आपके करियर लक्ष्यों के अनुसार तैयार कर सकूँ।",
        gu: "હું આ એટલા માટે પૂછી રહ્યો છું જેથી કરિયરફોર્જને તમારા કરિયર લક્ષ્યો મુજબ ગોઠવી શકાય.",
      };

      const explanation = isGujarati ? explObj.gu : isHindi ? explObj.hi : explObj.en;
      const followUp = isGujarati
        ? " શું તમે આ જણાવવા માંગો છો, કે પછી આપણે આગળ વધીએ?"
        : isHindi
        ? " क्या आप यह बताना चाहेंगे, या हम आगे बढ़ें?"
        : " Would you like to share this, or should we skip it for now?";

      return {
        shouldAsk: true,
        activeTaskId: activeTask,
        taskName: taskDef.name,
        missingRequirements: unresolvedReqs,
        nextRequirementToAsk: unresolvedReqs[0] || null,
        phrasedQuestion: `${explanation}${followUp}`,
        confirmationRequired: false,
        canExecuteTask: false,
        actionToExecute: null,
        taskSwitched: false,
        situationalNotice: explanation,
        extractedData: extraction.extractedFields,
        updatedContext,
      };
    }

    // Check if task has sufficient data to execute directly
    const canExecute = taskDef.canExecuteDirectly(evaluatedReqs);
    const criticalOrHighMissing = unresolvedReqs.some(
      (r) => r.importance === "critical" || r.importance === "high"
    );

    // ── 4. If all critical/high requirements are resolved, EXECUTE TASK DIRECTLY ──
    if (unresolvedReqs.length === 0 || (canExecute && !criticalOrHighMissing && !extraction.ambiguousFields.availableLearningTime)) {
      return {
        shouldAsk: false,
        activeTaskId: activeTask,
        taskName: taskDef.name,
        missingRequirements: [],
        nextRequirementToAsk: null,
        phrasedQuestion: null,
        confirmationRequired: false,
        canExecuteTask: true,
        actionToExecute: taskDef.executeActionDescription,
        taskSwitched,
        situationalNotice: situationalNotice || "I have enough information to proceed without additional questions.",
        extractedData: extraction.extractedFields,
        updatedContext,
      };
    }

    // ── 5. Adaptive Priority Ranking for Missing Information ──
    // Rank missing requirements based on:
    // 1. Dependency satisfaction (don't ask for timeline if targetRole is unknown)
    // 2. Critical importance over optional
    // 3. Ambiguity needing clarification
    const rankedMissing = [...unresolvedReqs].sort((a, b) => {
      // Prioritize ambiguous requirements so they are clarified immediately
      const aIsAmbiguous = a.status === "AMBIGUOUS" || Boolean(extraction.ambiguousFields[a.key]);
      const bIsAmbiguous = b.status === "AMBIGUOUS" || Boolean(extraction.ambiguousFields[b.key]);
      if (aIsAmbiguous && !bIsAmbiguous) return -1;
      if (!aIsAmbiguous && bIsAmbiguous) return 1;

      // Check dependencies: if b depends on a, a MUST come first
      if (b.dependencies.includes(a.key)) return -1;
      if (a.dependencies.includes(b.key)) return 1;

      // Importance ranking
      const importanceScore: Record<string, number> = {
        critical: 4,
        high: 3,
        medium: 2,
        optional: 1,
      };
      return (importanceScore[b.importance] || 0) - (importanceScore[a.importance] || 0);
    });

    const nextReq = rankedMissing[0];

    // If an ambiguous field was detected, prioritize clarifying it
    const hasAmbiguity =
      nextReq &&
      (Boolean(extraction.ambiguousFields[nextReq.key]) || nextReq.status === "AMBIGUOUS");
    const confirmationRequired = Boolean(nextReq?.confirmationRequired || hasAmbiguity);

    // ── 6. Dynamic Conversational Phrasing ──
    const ambiguityClarification =
      (nextReq && extraction.ambiguousFields[nextReq.key]) || nextReq?.ambiguityReason;

    const phrasedQuestion = this.phraseQuestionDynamically(
      nextReq,
      updatedContext,
      hasAmbiguity ? ambiguityClarification : undefined
    );

    // Record the prompt key for follow-up state tracking
    updatedKnown.activePromptKey = nextReq?.key;

    return {
      shouldAsk: true,
      activeTaskId: activeTask,
      taskName: taskDef.name,
      missingRequirements: rankedMissing,
      nextRequirementToAsk: nextReq,
      phrasedQuestion,
      confirmationRequired,
      canExecuteTask: canExecute,
      actionToExecute: canExecute ? taskDef.executeActionDescription : null,
      taskSwitched,
      situationalNotice,
      extractedData: extraction.extractedFields,
      updatedContext,
    };
  }

  /**
   * Phrases the question dynamically based on user persona, language, and context.
   * NEVER returns a hardcoded static question.
   */
  private static phraseQuestionDynamically(
    req: InformationRequirement,
    context: InformationResolutionContext,
    ambiguityClarification?: string
  ): string {
    if (!req) return "How would you like to proceed?";

    if (ambiguityClarification) {
      return ambiguityClarification;
    }

    const lang = (context.language || "en").toLowerCase();
    const isBusyUser = context.userPreferences?.persona === "busy" || context.userPreferences?.brief === true;
    const isHindi = lang.startsWith("hi") || lang === "hinglish";
    const isGujarati = lang.startsWith("gu") || lang === "gujlish";

    switch (req.key) {
      case "targetRole":
        if (isGujarati) {
          return "તમે કયા ટેકનિકલ રોલ અથવા કરિયર પાથ માટે આગળ વધવા માંગો છો?";
        }
        if (isHindi) {
          return "आप किस रोल या करियर ट्रैक के लिए लक्ष्य बना रहे हैं?";
        }
        return isBusyUser
          ? "What target role should we configure this for?"
          : "To tailor this accurately: what specific role or technology track are you aiming for?";

      case "availableLearningTime":
        if (isGujarati) {
          return "તમે દર અઠવાડિયે અંદાજે કેટલા કલાક અભ્યાસ માટે ફાળવી શકો છો?";
        }
        if (isHindi) {
          return "आप हर हफ्ते सीखने के लिए लगभग कितने घंटे दे सकते हैं?";
        }
        if (context.userProfile?.targetRole) {
          return `To build a realistic ${context.userProfile.targetRole} roadmap, how many hours can you set aside for learning each week?`;
        }
        return isBusyUser
          ? "How many hours weekly can you spend learning?"
          : "How much time can you realistically dedicate to learning each week?";

      case "experienceLevel":
        if (isGujarati) {
          return "આ ક્ષેત્રમાં તમારો અનુભવ કેવો છે — બિગિનર, ઇન્ટરમીડિયેટ કે કરિયર સ્વિચ કરી રહ્યા છો?";
        }
        if (isHindi) {
          return "इस फील्ड में आपका अनुभव कैसा है — बिगिनर, इंटरमीडिएट या करियर स्विच?";
        }
        return "Where would you place your current technical level: beginner, intermediate, or switching from another stack?";

      case "practiceTopic":
        // Context-aware adaptation: inspect if user struggled with a concept
        if (context.practiceHistory?.struggledConcepts?.length) {
          const struggle = context.practiceHistory.struggledConcepts[0];
          return `I noticed ${struggle} was challenging in recent practice. Would you like a focused drill on ${struggle}, or a different topic?`;
        }
        if (isGujarati) {
          return "તમે કયા ટોપિક અથવા લેંગ્વેજ પર ટેકનિકલ પ્રેક્ટિસ કરવા માંગો છો?";
        }
        if (isHindi) {
          return "आप किस टॉपिक या भाषा पर प्रैक्टिस करना चाहते हैं?";
        }
        return "Which technical concept or programming language would you like to drill today?";

      case "location":
        if (isGujarati) {
          return "તમે કયા શહેરમાં અથવા રિમોટ જોબ શોધવા માંગો છો?";
        }
        if (isHindi) {
          return "आप किस शहर में या रिमोट जॉब ढूंढना चाहते हैं?";
        }
        return "What city or region are you targeting, or are you looking for remote opportunities?";

      case "workMode":
        return "Do you prefer remote, hybrid, or onsite opportunities?";

      default:
        return `Could you provide a few details on your ${req.description.toLowerCase()}?`;
    }
  }
}
