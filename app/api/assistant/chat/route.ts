/**
 * POST /api/assistant/chat
 *
 * Real Central AI Career + Accessibility + Navigation Assistant for CareerForge:
 * - 100% Dynamic Runtime Reasoning across All 15 Platform Capabilities
 * - Multi-Tiered Provider Cascade (Groq, Gemini, OpenAI, GitHub Models, OpenRouter)
 * - Autonomous Cognitive Brain: Context-aware, Page-aware, Multi-tool execution
 * - True Multilingual Support (English, French, Hindi, Gujarati, Spanish, German, etc.)
 * - Natural Accessibility Discovery without medical disclosures
 * - Controlled Tool Registry: Navigation, Resumes, Jobs, Courses, Projects, GitHub, Alerts
 * - Conversational Step-by-Step Resume Builder (one question at a time)
 */

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import crypto from "crypto";
import { generateText } from "ai";
import { parseIntent, FeatureId, ResumeTab } from "@/lib/intent";
import { processResumeStepInput, ResumeDraftState } from "@/lib/conversationalResume";
import { normalizeSpokenEmail } from "@/lib/voice";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import {
  getCanonicalProvider,
  getModelInstance,
  mapProviderError,
  PROVIDER_LABELS,
  ProviderName,
} from "@/lib/ai/providerConfig";
import { aiTools } from "@/lib/ai/tools";
import { getScopedRagContext } from "@/lib/ai/rag/scopedRag";
import { createApiErrorResponse } from "@/lib/errors/apiError";
import { DynamicQuestionOrchestrator, CareerSynthesisEngine, AuthoritativeCareerState } from "@/lib/ai/orchestrator";


export const runtime = "nodejs";

const MAX_TOTAL_MESSAGE_LENGTH = 64 * 1024; // 64 KB

const ALLOWED_NAV_PAGES = new Set([
  "home",
  "resume",
  "roadmap",
  "courses",
  "practice",
  "local",
  "assistant",
  "dashboard",
  "/",
  "/dashboard",
  "/resume",
  "/assessment",
  "/internships",
  "/internships/view",
  "/audiobooks",
  "/progress",
]);

const ALLOWED_TABS = new Set(["analyzer", "personalizer", "builder"]);

function sanitizeNavPage(page: any): FeatureId | null {
  if (typeof page !== "string") return null;
  const clean = page.trim();
  if (
    clean.startsWith("javascript:") ||
    clean.startsWith("data:") ||
    clean.startsWith("http:") ||
    clean.startsWith("https:") ||
    clean.includes("..") ||
    clean.includes("//")
  ) {
    console.warn(`[Navigation Security] Blocked suspicious navigation target: ${clean}`);
    return null;
  }
  const lower = clean.toLowerCase();
  const stripped = lower.startsWith("/") ? lower.slice(1) : lower;
  if (stripped.startsWith("internship")) {
    return "local";
  }
  const validFeatures: FeatureId[] = ["resume", "roadmap", "courses", "practice", "local"];
  if (validFeatures.includes(stripped as FeatureId)) {
    return stripped as FeatureId;
  }
  return null;
}

function sanitizeTab(tab: any): ResumeTab | undefined {
  if (typeof tab !== "string") return undefined;
  const clean = tab.trim().toLowerCase();
  return ALLOWED_TABS.has(clean) ? (clean as ResumeTab) : undefined;
}



interface ChatMessage {
  role: "user" | "assistant";
  text?: string;
  content?: string;
}

interface RequestBody {
  messages: ChatMessage[];
  userProfile?: {
    name?: string;
    email?: string;
    targetRole?: string;
    skills?: string[];
    missingSkills?: string[];
    location?: string;
    experienceLevel?: string;
    availableLearningHours?: number;
    targetDeadlineDays?: number;
    roadmap?: any;
    practiceHistory?: any;
    resumeText?: string;
    hasResume?: boolean;
    atsScore?: number;
    interviewDate?: string;
    interviewUpcoming?: boolean;
    daysUntilInterview?: number;
    [key: string]: any;
  };
  targetRole?: string;
  voiceMode?: boolean;
  language?: string;
  conversationLanguageState?: {
    detectedLanguage?: string;
    preferredLanguage?: string;
  };
  currentPage?: string; // e.g. "assistant", "resume", "roadmap", "courses", "practice", "local"
  currentEntity?: {
    type?: "resume" | "job" | "course" | "roadmap" | "practice";
    id?: string;
    title?: string;
    data?: any;
  };
  accessibilityPrefs?: {
    interactionMode?: "voice" | "text" | "hybrid";
    speechOutput?: boolean;
    voiceNavigation?: boolean;
    visualResponses?: boolean;
    simplifiedLanguage?: boolean;
    captions?: boolean;
    screenReaderMode?: boolean;
    highContrast?: boolean;
    largeText?: boolean;
    reducedMotion?: boolean;
    voiceLanguage?: string;
  };
  resumeDraftState?: ResumeDraftState;
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const correlationId = req.headers.get("x-correlation-id") || req.headers.get("x-request-id") || crypto.randomUUID();
  const requestId = correlationId;

  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return createApiErrorResponse(
        "UNAUTHORIZED",
        "Authentication required to interact with the assistant.",
        requestId,
        { statusCode: 401, retryable: false }
      );
    }

    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return createApiErrorResponse(
        "BAD_REQUEST",
        "Invalid JSON request payload.",
        requestId,
        { statusCode: 400, retryable: false }
      );
    }

    const {
      messages,
      userProfile,
      targetRole,
      voiceMode,
      currentPage = "assistant",
      currentEntity,
      accessibilityPrefs,
      resumeDraftState,
    } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return createApiErrorResponse(
        "BAD_REQUEST",
        "Messages array required",
        requestId,
        { statusCode: 400, retryable: false }
      );
    }

    const totalMessageLength = messages.reduce(
      (sum, m) => sum + (typeof m?.text === "string" ? m.text.length : (typeof m?.content === "string" ? m.content.length : 0)),
      0
    );
    if (totalMessageLength > MAX_TOTAL_MESSAGE_LENGTH) {
      return createApiErrorResponse(
        "PAYLOAD_TOO_LARGE",
        `Messages content exceeds limit (${MAX_TOTAL_MESSAGE_LENGTH / 1024} KB).`,
        requestId,
        { statusCode: 413, retryable: false }
      );
    }

    const lastMessage = messages[messages.length - 1]?.text || messages[messages.length - 1]?.content || "";
    const userName = authUser.name || userProfile?.name || authUser.email.split("@")[0];
    const { getAuthoritativeCareerSnapshot, createDefaultCareerSnapshot, isCareerQuery, toAuthoritativeCareerState } = await import(
      "@/lib/ai/orchestrator/authoritativeCareerState"
    );
    // Only query the DB when the message requires authoritative career context.
    // General knowledge and concept questions bypass the snapshot entirely.
    const needsCareerState = isCareerQuery(lastMessage, currentPage);
    const careerSnapshot = needsCareerState
      ? await getAuthoritativeCareerSnapshot(authUser.id, authUser.email)
      : createDefaultCareerSnapshot(authUser.id);
    const role =
      careerSnapshot.targetRole.status === "KNOWN" && careerSnapshot.targetRole.currentValue
        ? careerSnapshot.targetRole.currentValue
        : "Software Engineering";



    // ─── Scoped RAG Domain Retrieval (Courses, Roadmap, Resume, Jobs) ─────────
    const ragResult = await getScopedRagContext(authUser.id, lastMessage, role);
    let systemPrompt = getSystemPrompt(
      userName,
      role,
      voiceMode,
      currentPage,
      currentEntity,
      accessibilityPrefs
    );
    if (ragResult.retrieved && ragResult.contextText) {
      systemPrompt += `\n${ragResult.contextText}\nDirective: Seamlessly synthesize the verified domain knowledge above when answering the user's inquiry.`;
    }

    // ─── Dynamic Question & Information Orchestration Context ─────────────────
    const dynamicOrchestrationContext = {
      currentPage,
      userProfile: {
        name: userName,
        email: authUser.email,
        targetRole: careerSnapshot.targetRole.currentValue || undefined,
        skills: careerSnapshot.skills.currentValue || [],
        missingSkills: careerSnapshot.missingSkills.currentValue || [],
        location: userProfile?.location,
      },
      conversationHistory: messages.map((m) => ({
        role: m.role,
        text: m.text || m.content || "",
      })),
      knownInformation: {
        fullName: userName,
        name: userName,
        ...(careerSnapshot.targetRole.currentValue ? { targetRole: careerSnapshot.targetRole.currentValue } : {}),
        ...(userProfile?.location ? { location: userProfile.location } : {}),
        ...(careerSnapshot.skills.currentValue?.length ? { skills: careerSnapshot.skills.currentValue } : {}),
      },
      language: body.language || body.conversationLanguageState?.detectedLanguage || "en",
      accessibilityPreferences: accessibilityPrefs,
    };

    const orchestrationDecision = DynamicQuestionOrchestrator.evaluateNextStep(
      dynamicOrchestrationContext,
      lastMessage
    );

    systemPrompt += `\n\nDYNAMIC QUESTION & INFORMATION ORCHESTRATOR DIRECTIVES:
- Task: ${orchestrationDecision.taskName} (ID: ${orchestrationDecision.activeTaskId})
- Known Information: ${JSON.stringify(orchestrationDecision.updatedContext.knownInformation)}
- Missing Requirements: ${orchestrationDecision.missingRequirements.length > 0 ? orchestrationDecision.missingRequirements.map((r) => `${r.key} [${r.importance}]`).join(", ") : "None. All required information is known."}
- Execution Status: ${orchestrationDecision.canExecuteTask ? "CAN EXECUTE DIRECTLY. DO NOT ask redundant questions." : "Missing critical information."}
- Dynamic Guidance: ${orchestrationDecision.shouldAsk ? `Next high-priority detail to discover: "${orchestrationDecision.nextRequirementToAsk?.key}". Suggested dynamic phrasing: "${orchestrationDecision.phrasedQuestion}". Do NOT use static questionnaire forms; combine fields naturally.` : `Do not ask any more questions. Proceed directly with the requested task or explanation.`}`;

    // ─── Authoritative Cross-Module Career State Synthesis (career queries only) ──
    const synthQueryType = needsCareerState ? CareerSynthesisEngine.detectQueryType(lastMessage) : null;
    if (synthQueryType) {
      // Deterministically derive authoritative state strictly from server snapshot
      const careerState = toAuthoritativeCareerState(careerSnapshot);

      const synth = CareerSynthesisEngine.synthesize(synthQueryType, careerState, body.language || "en");
      systemPrompt += `\n\nAUTHORITATIVE CROSS-MODULE CAREER SYNTHESIS:
- Query Identified: "${synthQueryType}"
- Focus Area: "${synth.primaryFocus}"
- Authoritative Rationale: "${synth.rationale}"
- Grounded Recommendation: "${synth.spokenRecommendation}"
- Action Step: "${synth.actionableStep}"
- Application Facts: ${JSON.stringify(synth.authoritativeFacts)}
DIRECTIVE: Communicate these exact authoritative facts naturally to the user. DO NOT invent or contradict any application state facts.`;
    }

    // ─── Canonical AI Assistant Provider Gateway ──────────────────────────
    const providerResult = await callLLMProvider(messages, systemPrompt, voiceMode);
    if (providerResult.error) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: providerResult.error.code,
            message: providerResult.error.message,
          },
        },
        { status: providerResult.error.statusCode }
      );
    }

    const durationMs = Date.now() - startTime;
    return NextResponse.json(
      {
        ...providerResult.data,
        isFallback: false,
        careerStateSnapshot: {
          userId: authUser.id,
          targetRole: careerSnapshot.targetRole.currentValue,
          status: careerSnapshot.targetRole.status,
          lastUpdated: careerSnapshot.lastUpdated,
        },
      },
      {
        headers: {
          "x-correlation-id": correlationId,
          "x-request-id": correlationId,
        },
      }
    );
  } catch (error) {
    console.error("[Assistant API] Fatal error:", error);
    return createApiErrorResponse(
      "AI_PROVIDER_UNAVAILABLE",
      "The AI assistant is temporarily unavailable. Please try again shortly.",
      correlationId,
      { statusCode: 503 }
    );
  }
}

// ─── Central Conversational System Prompt ─────────────────────────────────────
function getSystemPrompt(
  userName: string,
  role: string,
  voiceMode = false,
  currentPage = "assistant",
  currentEntity?: any,
  accessibilityPrefs?: any
) {
  return `You are ubix Assistant, the central Career Assistant + Accessibility Assistant + Workspace Assistant for ubix.
You are collaborating with ${userName}, whose target role is "${role}".
Current Active Page: "${currentPage}".
${currentEntity ? `Active Entity Context: ${JSON.stringify(currentEntity)}` : ""}
${accessibilityPrefs ? `Current Accessibility Preferences: ${JSON.stringify(accessibilityPrefs)}` : ""}

Core Directives & Behavioral Guidelines:
1. VERSATILE AI CO-PILOT: You are a versatile frontier AI. You naturally answer ANY question with depth, warmth, and clarity (e.g., world leaders like PM Modi, science topics like photosynthesis, programming concepts like polymorphism, algorithms like binary search in Python). When the user asks general or conceptual questions, answer them directly and comprehensively—do NOT force general inquiries into career actions. Connect to CareerForge platform tools (Resume, Roadmap, Courses, Practice, Jobs) ONLY when the user specifically requests platform actions.
2. MULTILINGUAL REASONING: Automatically detect the language of the user's message (English, French, Hindi, Gujarati, Spanish, German, etc.) and ALWAYS reply in that EXACT same language. Allow natural multilingual switching.
3. NATURAL ACCESSIBILITY DISCOVERY:
   - Do NOT ask for medical diagnoses or claim the user is blind, deaf, or disabled.
   - Detect interaction difficulties naturally:
     - "I can't see where to click" → Offer voice navigation and high contrast.
     - "I can't hear you" → Switch to visual responses with speech output disabled.
     - "Typing is difficult" → Offer voice dictation and speech form filling.
     - "These questions are difficult" → Use simpler, shorter language.
4. TONE, PERSONALITY & FEELING (CLAUDE & CHATGPT CALIBER):
   - Never give sterile, robotic, or dry dictionary definitions. 
   - Radiate genuine human warmth, emotional intelligence, empathy, patience, and intellectual curiosity.
   - For any question, think about the underlying curiosity or human feeling: illuminate the 'big picture' first using vivid, intuitive analogies before gracefully breaking down the core mechanics.
   - When addressing career or tech challenges, be profoundly encouraging, calming anxiety and empowering the user.
5. VOICE CONCISENESS: ${voiceMode ? "Keep replies punchy (2-4 clear, warm sentences) and easy to listen to." : "Provide structured, beautifully readable markdown with intuitive metaphors and clear bullet points where appropriate."}
6. CONFIRMATION ON CRITICAL FIELDS: Always confirm spoken contact info (email address) before finalizing. Never submit a job application without explicit user confirmation.
7. ACTION DIRECTIVES (Append on its own final line ONLY when triggering a tool):
   - [ACTION: {"tool": "navigateTo", "page": "resume" | "roadmap" | "courses" | "practice" | "local", "tab": "analyzer" | "personalizer" | "builder"}]
   - [ACTION: {"tool": "searchJobs", "role": "Frontend Developer", "location": "Ahmedabad", "remote": true}]
   - [ACTION: {"tool": "searchCourses", "topic": "React", "freeOnly": true}]
   - [ACTION: {"tool": "searchProjects", "skill": "React", "difficulty": "Beginner"}]
   - [ACTION: {"tool": "searchGithub", "query": "react", "topic": "frontend"}]
   - [ACTION: {"tool": "configureJobAlerts", "email": "user@example.com", "role": "Frontend", "location": "Remote"}]
   - [ACTION: {"tool": "updateAccessibilityPreferences", "prefs": {"speechOutput": false, "visualResponses": true}}]
   - [ACTION: {"tool": "conversationalResumeBuilder", "step": 1}]`;
}

// ─── Canonical AI Assistant Provider Gateway ──────────────────────────────────
async function callLLMProvider(
  messages: ChatMessage[],
  systemPrompt: string,
  voiceMode = false
): Promise<{
  data?: {
    reply: string;
    engine: string;
    feature?: FeatureId | null;
    resumeTab?: ResumeTab;
    featureTitle?: string;
    toolCall?: any;
  };
  error?: {
    code: string;
    statusCode: number;
    message: string;
  };
}> {
  const providerInfo = getCanonicalProvider();

  // Test Mock Provider handling (deterministic, hermetic unit tests)
  if (providerInfo.isMock) {
    return {
      data: {
        reply: "UBIX_MOCK_ASSISTANT_OK: Processed turn with authoritative context.",
        engine: "Mock Test Provider (deterministic)",
      },
    };
  }

  // 1. Missing Key Contract: Never fake AI responses
  if (!providerInfo.isConfigured || !providerInfo.apiKey) {
    return {
      error: {
        code: "AI_PROVIDER_NOT_CONFIGURED",
        statusCode: 503,
        message: "AI assistant is temporarily unavailable because no AI provider is configured.",
      },
    };
  }

  const formattedMessages: any[] = messages.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.text || m.content || "",
  }));

  try {
    const model = getModelInstance(providerInfo.provider as ProviderName, providerInfo.apiKey);
    const result = await generateText({
      model,
      system: systemPrompt,
      messages: formattedMessages,
      tools: aiTools,
      maxOutputTokens: voiceMode ? 400 : 900,
      temperature: 0.35,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(15000),
    });

    const rawReply = result.text || "";
    let feature: FeatureId | null = null;
    let resumeTab: ResumeTab | undefined = undefined;
    let featureTitle: string | undefined = undefined;
    let toolCall: any = null;

    // 1. Check AI SDK native tool calls
    if (result.toolCalls && result.toolCalls.length > 0) {
      const firstCall = result.toolCalls[0] as any;
      const callArgs = firstCall.args || firstCall.parameters || {};
      toolCall = {
        tool: firstCall.toolName,
        parameters: callArgs,
      };

      if (firstCall.toolName === "navigateTo" || firstCall.toolName === "openResume") {
        feature = sanitizeNavPage(callArgs?.page);
        resumeTab = sanitizeTab(callArgs?.tab);
        if (!feature && firstCall.toolName === "openResume") {
          feature = "resume";
        }
      } else if (firstCall.toolName === "openRoadmap") {
        feature = "roadmap";
      } else if (firstCall.toolName === "showSkillGaps" || firstCall.toolName === "openSkillAnalysis") {
        feature = "resume";
        resumeTab = "analyzer";
      } else if (firstCall.toolName === "buildResume") {
        feature = "resume";
        resumeTab = "builder";
      } else if (firstCall.toolName === "searchJobs" || firstCall.toolName === "findJobs") {
        feature = "local";
      } else if (firstCall.toolName === "searchCourses" || firstCall.toolName === "openLearning") {
        feature = "courses";
      } else if (firstCall.toolName === "startPractice") {
        feature = "practice";
      } else if (firstCall.toolName === "showProgress") {
        feature = "practice";
      } else if (firstCall.toolName === "goHome") {
        feature = "resume";
      }
    }

    // 2. If no native tool call was triggered, fallback to parsing [ACTION: ...] if present
    if (!toolCall && rawReply.includes("[ACTION:")) {
      const parsedAction = parseActionFromReply(rawReply);
      feature = parsedAction.feature;
      resumeTab = parsedAction.resumeTab;
      featureTitle = parsedAction.featureTitle;
      toolCall = parsedAction.toolCall;
    }

    // 3. Clean raw text if [ACTION: ...] was emitted in text
    const cleanReply = rawReply.replace(/\[ACTION:[\s\S]*?\]/g, "").trim();

    return {
      data: {
        reply: cleanReply || "Action executed.",
        engine: PROVIDER_LABELS[providerInfo.provider] || providerInfo.provider,
        feature,
        resumeTab,
        featureTitle,
        toolCall,
      },
    };
  } catch (err: any) {
    console.error(`[Assistant API] Upstream ${providerInfo.provider} failure:`, err?.message || "Provider error");
    return {
      error: mapProviderError(err),
    };
  }
}




// ─── Action Parser Helper ─────────────────────────────────────────────────────
function parseActionFromReply(rawReply: string) {
  const actionMatch = rawReply.match(/\[ACTION:\s*(\{[\s\S]*?\})\s*\]/);
  let feature: FeatureId | null = null;
  let resumeTab: ResumeTab | undefined = undefined;
  let featureTitle: string | undefined = undefined;
  let toolCall: any = null;
  let cleanReply = rawReply;

  if (actionMatch) {
    cleanReply = rawReply.replace(/\[ACTION:[\s\S]*?\]/g, "").trim();
    try {
      const parsed = JSON.parse(actionMatch[1]);
      const ALLOWED_TOOL_NAMES = new Set<string>([
        "navigateTo",
        "openRoadmap",
        "showSkillGaps",
        "openResume",
        "buildResume",
        "openSkillAnalysis",
        "searchJobs",
        "findJobs",
        "searchCourses",
        "openLearning",
        "startPractice",
        "showProgress",
        "goHome",
        "goBack",
        "searchProjects",
        "searchGithub",
        "openJob",
        "configureJobAlerts",
        "modifyProfile",
        "deleteUserData",
        "updateAccessibilityPreferences",
        "conversationalResumeBuilder",
        "updateUserProfile",
        "readPage",
      ]);

      if (parsed.tool && ALLOWED_TOOL_NAMES.has(parsed.tool)) {
        toolCall = parsed;
        if (parsed.tool === "navigateTo" || parsed.tool === "openResume") {
          feature = sanitizeNavPage(parsed.page || parsed.parameters?.page);
          resumeTab = sanitizeTab(parsed.tab || parsed.parameters?.tab);
          if (!feature && parsed.tool === "openResume") {
            feature = "resume";
          } else if (!feature) {
            // Unsafe or invalid navigation destination; discard toolCall
            toolCall = null;
          } else {
            toolCall.page = feature;
            toolCall.tab = resumeTab;
            if (toolCall.parameters) {
              toolCall.parameters.page = feature;
              toolCall.parameters.tab = resumeTab;
            }
          }
        } else if (parsed.tool === "openRoadmap") {
          feature = "roadmap";
        } else if (parsed.tool === "showSkillGaps" || parsed.tool === "openSkillAnalysis") {
          feature = "resume";
          resumeTab = "analyzer";
        } else if (parsed.tool === "buildResume") {
          feature = "resume";
          resumeTab = "builder";
        } else if (parsed.tool === "searchJobs" || parsed.tool === "findJobs") {
          feature = "local";
        } else if (parsed.tool === "searchCourses" || parsed.tool === "openLearning") {
          feature = "courses";
        } else if (parsed.tool === "startPractice") {
          feature = "practice";
        } else if (parsed.tool === "showProgress") {
          feature = "practice";
        } else if (parsed.tool === "goHome") {
          feature = "resume";
        }
      } else if (parsed.feature) {
        feature = sanitizeNavPage(parsed.feature);
        resumeTab = sanitizeTab(parsed.resumeTab);
        featureTitle = parsed.featureTitle;
      }
    } catch {
      // ignore
    }
  }

  return {
    reply: cleanReply,
    feature,
    resumeTab,
    featureTitle,
    toolCall,
  };
}
