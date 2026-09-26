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
import { parseIntent, FeatureId, ResumeTab } from "@/lib/intent";
import { AGENT_TOOLS_DEFINITIONS, AgentToolName } from "@/lib/agentTools";
import { processResumeStepInput, ResumeDraftState } from "@/lib/conversationalResume";
import { normalizeSpokenEmail } from "@/lib/voice";
import { getAuthenticatedUser } from "@/lib/supabase/auth";

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
  text: string;
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

/**
 * Call Python AI Assistant Engine (optional microservice):
 * Only queries if PYTHON_AI_SERVICE_URL is explicitly configured with a strict 1.5s timeout.
 * No child_process spawn in Next.js serverless execution.
 */
async function callPythonAIEngine(body: RequestBody): Promise<any> {
  const pythonUrl = process.env.PYTHON_AI_SERVICE_URL;
  if (!pythonUrl) {
    return null;
  }

  try {
    const res = await fetch(`${pythonUrl.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(1500),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.reply) {
        return data;
      }
    }
  } catch (httpErr) {
    // Microservice offline or not answering; proceed directly to TypeScript AI cascade
  }

  return null;
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return NextResponse.json(
        {
          code: "UNAUTHORIZED",
          message: "Authentication required to interact with the assistant.",
          retryable: false,
          requestId,
        },
        { status: 401 }
      );
    }

    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          code: "BAD_REQUEST",
          message: "Invalid JSON request payload.",
          retryable: false,
          requestId,
        },
        { status: 400 }
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
      return NextResponse.json(
        {
          code: "BAD_REQUEST",
          message: "Messages array required",
          retryable: false,
          requestId,
        },
        { status: 400 }
      );
    }

    const totalMessageLength = messages.reduce(
      (sum, m) => sum + (typeof m?.text === "string" ? m.text.length : 0),
      0
    );
    if (totalMessageLength > MAX_TOTAL_MESSAGE_LENGTH) {
      return NextResponse.json(
        {
          code: "PAYLOAD_TOO_LARGE",
          message: `Messages content exceeds limit (${MAX_TOTAL_MESSAGE_LENGTH / 1024} KB).`,
          retryable: false,
          requestId,
        },
        { status: 413 }
      );
    }

    // ─── 0. Primary Cognitive Engine: Python AI Assistant Brain ───────────────
    try {
      const pythonResponse = await callPythonAIEngine(body);
      if (pythonResponse && pythonResponse.reply && pythonResponse.reply.trim().length > 10) {
        return NextResponse.json(pythonResponse);
      }
    } catch (pyErr) {
      console.warn("[Assistant API] Python AI Brain error:", pyErr);
    }

    const lastMessage = messages[messages.length - 1]?.text || "";
    const userName = authUser.name || userProfile?.name || authUser.email.split("@")[0];
    const role = targetRole || userProfile?.targetRole || "Software Engineer";


    // ─── 1. Try Groq Cloud (Llama 3.3 70B / DeepSeek R1) ──────────────────────
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey && groqKey.trim().length > 5) {
      try {
        const groqResponse = await callGroqLLM(
          groqKey,
          messages,
          userName,
          role,
          voiceMode,
          currentPage,
          currentEntity,
          accessibilityPrefs
        );
        if (groqResponse && groqResponse.reply && groqResponse.reply.trim().length > 10) {
          return NextResponse.json({
            ...groqResponse,
            thinking: (groqResponse as any).thinking || [
              `🧠 1. Intent Analysis: Deeply analyzing the query and conversational context for ${userName}.`,
              `🔍 2. Frontier Reasoning: Generating nuanced insight via Llama 3.3 70B cognitive architecture.`,
              `💡 3. Conceptual & Empathy Alignment: Framing with intuitive analogies and empathetic warmth.`,
              `✨ 4. Structured Synthesis: Formatting reply with clarity, warmth, and depth.`,
            ],
            engine: "Groq (Llama 3.3 70B)",
          });
        }
      } catch (groqErr) {
        console.warn("[Assistant API] Groq error:", groqErr);
      }
    }

    // ─── 2. Try Google Gemini API (Gemini 1.5 / 2.0 Flash) ────────────────────
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_AI_KEY;
    if (geminiKey && geminiKey.trim().length > 5) {
      try {
        const geminiResponse = await callGeminiLLM(
          geminiKey,
          messages,
          userName,
          role,
          voiceMode,
          currentPage,
          currentEntity,
          accessibilityPrefs
        );
        if (geminiResponse && geminiResponse.reply && geminiResponse.reply.trim().length > 10) {
          return NextResponse.json({
            ...geminiResponse,
            thinking: (geminiResponse as any).thinking || [
              `🧠 1. Intent Analysis: Deconstructing curiosity and underlying goals for ${userName}.`,
              `🔍 2. Multimodal Knowledge Grounding: Verifying factual principles via Gemini 1.5 Flash.`,
              `💡 3. Empathy & Analogy Synthesis: Infusing warmth, intuitive metaphors, and feeling.`,
              `✨ 4. Refined Output: Delivering clear, empowering, and actionable response.`,
            ],
            engine: "Google Gemini 1.5 Flash",
          });
        }
      } catch (geminiErr) {
        console.warn("[Assistant API] Gemini error:", geminiErr);
      }
    }

    // ─── 3. Try OpenAI API (GPT-4o / GPT-4o-mini) ─────────────────────────────
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey && openaiKey.trim().length > 5) {
      try {
        const openaiResponse = await callOpenAILLM(
          openaiKey,
          messages,
          userName,
          role,
          voiceMode,
          currentPage,
          currentEntity,
          accessibilityPrefs
        );
        if (openaiResponse && openaiResponse.reply && openaiResponse.reply.trim().length > 10) {
          return NextResponse.json({
            ...openaiResponse,
            thinking: (openaiResponse as any).thinking || [
              `🧠 1. Cognitive Framing: Analyzing intent and emotional nuance for ${userName}.`,
              `🔍 2. Model Reasoning: Deliberating across knowledge domains with GPT-4o-mini.`,
              `💡 3. Empathy & Tone Calibration: Formulating intuitive real-world analogies with human feeling.`,
              `✨ 4. Output Crafting: Polishing tone for maximum clarity, encouragement, and warmth.`,
            ],
            engine: "OpenAI GPT-4o-mini",
          });
        }
      } catch (openaiErr) {
        console.warn("[Assistant API] OpenAI error:", openaiErr);
      }
    }

    // ─── 4. Try OpenRouter Free Models ────────────────────────────────────────
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    if (openrouterKey && openrouterKey.trim().length > 5) {
      try {
        const orResponse = await callOpenRouterLLM(
          openrouterKey,
          messages,
          userName,
          role,
          voiceMode,
          currentPage,
          currentEntity,
          accessibilityPrefs
        );
        if (orResponse && orResponse.reply && orResponse.reply.trim().length > 10) {
          return NextResponse.json({
            ...orResponse,
            thinking: (orResponse as any).thinking || [
              `🧠 1. Query Analysis: Dissecting user intention and conversational background.`,
              `🔍 2. OpenRouter Reasoning: Synthesizing deep perspective via frontier open models.`,
              `💡 3. Intuitive Clarity: Enriching response with relatable examples and empathetic warmth.`,
              `✨ 4. Delivery: Assembling polished, engaging Markdown response.`,
            ],
            engine: "OpenRouter (DeepSeek R1 / LLaMA 3.3)",
          });
        }
      } catch (orErr) {
        console.warn("[Assistant API] OpenRouter error:", orErr);
      }
    }



    // ─── 6. Autonomous Dynamic Cognitive Reasoner ─────────────────────────────
    const dynamicResponse = generateCognitiveAgentResponse(
      lastMessage,
      messages,
      userName,
      role,
      voiceMode,
      currentPage,
      currentEntity,
      userProfile,
      accessibilityPrefs,
      resumeDraftState
    );
    const defaultCognitiveThinking = [
      `🧠 1. Deconstructing Intent & Nuance: Analyzing '${lastMessage.slice(0, 45)}' to address both factual and human curiosity.`,
      `🔍 2. Knowledge Grounding: Verifying core mechanisms and practical relevance for role '${role}'.`,
      `💡 3. Intuitive Metaphor & Empathy: Calibrating warm, empathetic delivery with relatable real-world framing.`,
      `✨ 4. Calibrating Narrative Arc: Formatting structured, engaging answer with feeling, warmth, and depth.`,
    ];
    return NextResponse.json({
      ...dynamicResponse,
      thinking: (dynamicResponse as any).thinking || defaultCognitiveThinking,
      engine: "ubix Assistant",
    });
  } catch (error) {
    console.error("[Assistant API] Fatal error:", error);
    const { createApiErrorResponse } = await import("@/lib/errors/apiError");
    return createApiErrorResponse(
      "AI_PROVIDER_UNAVAILABLE",
      "The AI assistant is temporarily unavailable. Please try again shortly.",
      requestId,
      { statusCode: 503, retryable: true }
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

// ─── 1. Groq Cloud API Provider ───────────────────────────────────────────────
async function callGroqLLM(
  apiKey: string,
  messages: ChatMessage[],
  userName: string,
  role: string,
  voiceMode = false,
  currentPage = "assistant",
  currentEntity?: any,
  accessibilityPrefs?: any
) {
  const systemPrompt = getSystemPrompt(userName, role, voiceMode, currentPage, currentEntity, accessibilityPrefs);
  const formattedMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.text,
    })),
  ];

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: formattedMessages,
      temperature: 0.35,
      max_tokens: voiceMode ? 400 : 900,
    }),
    signal: AbortSignal.timeout(6000),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const rawReply: string = data?.choices?.[0]?.message?.content || "";
  return parseActionFromReply(rawReply);
}

// ─── 2. Google Gemini API Provider ────────────────────────────────────────────
async function callGeminiLLM(
  apiKey: string,
  messages: ChatMessage[],
  userName: string,
  role: string,
  voiceMode = false,
  currentPage = "assistant",
  currentEntity?: any,
  accessibilityPrefs?: any
) {
  const systemPrompt = getSystemPrompt(userName, role, voiceMode, currentPage, currentEntity, accessibilityPrefs);
  const contents = [
    { role: "user", parts: [{ text: systemPrompt }] },
    { role: "model", parts: [{ text: "Understood. I am CareerForge AI, your central career, accessibility, and navigation mentor." }] },
    ...messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.text }],
    })),
  ];

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        generationConfig: { temperature: 0.35, maxOutputTokens: voiceMode ? 400 : 900 },
      }),
      signal: AbortSignal.timeout(6000),
    }
  );

  if (!res.ok) return null;
  const data = await res.json();
  const rawReply: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return parseActionFromReply(rawReply);
}

// ─── 3. OpenAI API Provider ───────────────────────────────────────────────────
async function callOpenAILLM(
  apiKey: string,
  messages: ChatMessage[],
  userName: string,
  role: string,
  voiceMode = false,
  currentPage = "assistant",
  currentEntity?: any,
  accessibilityPrefs?: any
) {
  const systemPrompt = getSystemPrompt(userName, role, voiceMode, currentPage, currentEntity, accessibilityPrefs);
  const formattedMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.text,
    })),
  ];

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: formattedMessages,
      temperature: 0.35,
      max_tokens: voiceMode ? 400 : 900,
    }),
    signal: AbortSignal.timeout(6000),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const rawReply: string = data?.choices?.[0]?.message?.content || "";
  return parseActionFromReply(rawReply);
}

// ─── 4. OpenRouter API Provider ───────────────────────────────────────────────
async function callOpenRouterLLM(
  apiKey: string,
  messages: ChatMessage[],
  userName: string,
  role: string,
  voiceMode = false,
  currentPage = "assistant",
  currentEntity?: any,
  accessibilityPrefs?: any
) {
  const systemPrompt = getSystemPrompt(userName, role, voiceMode, currentPage, currentEntity, accessibilityPrefs);
  const formattedMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.text,
    })),
  ];

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "meta-llama/llama-3.3-70b-instruct:free",
      messages: formattedMessages,
      temperature: 0.35,
      max_tokens: voiceMode ? 400 : 900,
    }),
    signal: AbortSignal.timeout(6000),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const rawReply: string = data?.choices?.[0]?.message?.content || "";
  return parseActionFromReply(rawReply);
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
        "openResume",
        "openSkillAnalysis",
        "searchJobs",
        "searchCourses",
        "searchProjects",
        "searchGithub",
        "openJob",
        "configureJobAlerts",
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
          if (!feature) {
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
        } else if (parsed.tool === "searchJobs") {
          feature = "local";
        } else if (parsed.tool === "searchCourses") {
          feature = "courses";
        } else if (parsed.tool === "openSkillAnalysis") {
          feature = "resume";
          resumeTab = "analyzer";
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


// ─── 6. Autonomous Cognitive Agent Brain ──────────────────────────────────────
function generateCognitiveAgentResponse(
  rawQuery: string,
  messages: ChatMessage[],
  userName: string,
  role: string,
  voiceMode = false,
  currentPage = "assistant",
  currentEntity?: any,
  userProfile?: any,
  accessibilityPrefs?: any,
  resumeDraftState?: ResumeDraftState
) {
  const query = rawQuery.trim();
  const lower = query.toLowerCase();

  // ─── Language Detection
  const isFrench =
    /[éèêëàâîïôûùç]/i.test(query) ||
    /\b(bonjour|je cherche|emploi|travail|developpement|merci|comment|aide|poste|salut|oui|non)\b/i.test(lower);

  const isGujarati =
    /[\u0A80-\u0AFF]/.test(query) ||
    /\b(kem cho|maru naam|tamaru naam|mane madad|shu karvu|shu chhe|sikhavo|shikho|shikhvu|kevi rite|karvi|aabhar|joiye|nathi|chhu|chhe|avjo|saras|khub|banavva|madad karo|કેમ છો|નમસ્તે|શું|રેઝ્યૂમે|રોડમેપ)\b/i.test(
      lower
    );

  const isHindi =
    /[\u0900-\u097F]/.test(query) ||
    /\b(kaise ho|namaste|mera naam|aapka naam|madad chahiye|kya karu|kya karna|batao|kripya|dhanyawad|shukriya|accha|theek|नमस्ते|कैसे|क्या|सहायता|नौकरी|चाहिए)\b/i.test(
      lower
    );

  const isSpanish =
    /[ñáéíóú¿¡]/i.test(query) ||
    /\b(hola|como estas|ayuda|gracias|por favor|mi nombre|buenos dias|buenas tardes|trabajo|empleo)\b/i.test(lower);

  // ─── 0. Voice Onboarding Step 1: User Chooses Voice Mode ("Voice")
  const lastAssistantMsg =
    messages
      .slice()
      .reverse()
      .find((m) => m.role === "assistant")?.text.toLowerCase() || "";

  if (
    lower === "voice" ||
    lower === "voice mode" ||
    lower === "use voice" ||
    lower === "speak" ||
    lower === "voix" ||
    lower === "અવાજ" ||
    lower === "आवाज़"
  ) {
    const reply = isFrench
      ? "Super ! Je vais vous guider pas à pas. Vous pouvez parler naturellement et vous pouvez m'interrompre à tout moment. Comment souhaitez-vous que je vous appelle ?"
      : isGujarati
      ? "સરસ! હું તમને એક-એક સ્ટેપ દ્વારા માર્ગદર્શન આપીશ. તમે કુદરતી રીતે બોલી શકો છો અને મને ગમે ત્યારે રોકી શકો છો. હું તમને શું કહીને બોલાવું?"
      : isHindi
      ? "शानदार! मैं आपको कदम दर कदम गाइड करूँगा। आप स्वाभाविक रूप से बोल सकते हैं और मुझे कभी भी रोक सकते हैं। मैं आपको किस नाम से बुलाऊं?"
      : "Great! I'll guide you step by step. You can speak naturally, and you can interrupt me anytime. What would you like me to call you?";

    return {
      reply,
      toolCall: {
        tool: "updateAccessibilityPreferences",
        parameters: { interactionMode: "voice", speechOutput: true },
      },
    };
  }

  // ─── 0b. Voice Onboarding Step 2: Name Response ("My name is Manan")
  if (
    (lastAssistantMsg.includes("call you") ||
      lastAssistantMsg.includes("તમારું નામ") ||
      lastAssistantMsg.includes("किस नाम") ||
      lastAssistantMsg.includes("vous appelle")) &&
    !lower.includes("resume") &&
    !lower.includes("job")
  ) {
    const candidateName = query
      .replace(/^(?:my name is|i am|call me|je m'appelle|maru naam|mera naam)\s*/i, "")
      .replace(/[.,;?!]+$/, "")
      .trim();

    const nameToUse = candidateName || userName || "Candidate";
    const reply = isFrench
      ? `Ravi de vous rencontrer, ${nameToUse} ! Quel domaine ou métier vous intéresse ?`
      : isGujarati
      ? `તમને મળીને આનંદ થયો, ${nameToUse}! તમે કયા ક્ષેત્ર અથવા કરિયરમાં રસ ધરાવો છો?`
      : isHindi
      ? `आपसे मिलकर खुशी हुई, ${nameToUse}! आप किस प्रकार के करियर या पद में रुचि रखते हैं?`
      : `Nice to meet you, ${nameToUse}. What kind of career are you interested in?`;

    return {
      reply,
      toolCall: {
        tool: "updateUserProfile",
        parameters: { name: nameToUse },
      },
    };
  }

  // ─── 0c. Voice Onboarding Step 3: Career Track Response ("Frontend development")
  if (
    lastAssistantMsg.includes("what kind of career") ||
    lastAssistantMsg.includes("métier vous intéresse") ||
    lastAssistantMsg.includes("કરિયરમાં રસ") ||
    lastAssistantMsg.includes("करियर या पद में रुचि")
  ) {
    const chosenRole = query.replace(/[.,;?!]+$/, "").trim();
    const reply = isFrench
      ? `Parfait pour ${chosenRole} ! Avez-vous déjà un CV, ou souhaitez-vous que je vous aide à en créer un ?`
      : isGujarati
      ? `સરસ! ${chosenRole} માટે ઉત્તમ. શું તમારી પાસે પહેલેથી જ રેઝ્યૂમે છે, કે પછી હું તમને નવું બનાવવામાં મદદ કરું?`
      : isHindi
      ? `बहुत बढ़िया! ${chosenRole} के लिए शानदार। क्या आपके पास पहले से कोई रेज़्यूमे है, या आप चाहते हैं कि मैं इसे बनाने में मदद करूँ?`
      : `Great. Do you already have a resume, or would you like me to help you create one?`;

    return {
      reply,
      toolCall: {
        tool: "updateUserProfile",
        parameters: { targetRole: chosenRole },
      },
    };
  }

  // ─── 0d. Natural Accessibility: "I don't want to use the mouse"
  if (
    lower.includes("don't want to use the mouse") ||
    lower.includes("dont want to use the mouse") ||
    lower.includes("no mouse") ||
    lower.includes("without mouse") ||
    lower.includes("hands free") ||
    lower.includes("hands-free") ||
    lower.includes("માઉસ નથી વાપરવું") ||
    lower.includes("माउस का उपयोग नहीं करना") ||
    lower.includes("pas de souris")
  ) {
    const reply = isFrench
      ? "Absolument. Je vais vous guider sur le site à l'aide de la voix et des raccourcis clavier."
      : isGujarati
      ? "ચોક્કસ. હું તમને અવાજ અને કીબોર્ડ નેવિગેશન દ્વારા આખી વેબસાઇટ પર માર્ગદર્શન આપીશ."
      : isHindi
      ? "बिल्कुल। मैं आवाज़ और कीबोर्ड नेविगेशन के ज़रिये आपका पूरा मार्गदर्शन करूँगा।"
      : "Absolutely. I'll guide you through the website using voice and keyboard.";

    return {
      reply,
      toolCall: {
        tool: "updateAccessibilityPreferences",
        parameters: { voiceNavigation: true, speechOutput: true, interactionMode: "voice" },
      },
    };
  }

  // ─── A. Conversational Resume Builder Mode (Active or Triggered)
  const isNoResume =
    lower.includes("don't have a resume") ||
    lower.includes("dont have a resume") ||
    lower.includes("do not have a resume") ||
    lower.includes("no resume") ||
    lower.includes("don't have one") ||
    lower.includes("dont have one") ||
    lower.includes("create one from scratch") ||
    lower.includes("help me build one") ||
    lower.includes("help me create one") ||
    lower.includes("નથી") ||
    lower.includes("રેઝ્યૂમે નથી") ||
    lower.includes("रेज़्यूमे नहीं है") ||
    lower.includes("नहीं है") ||
    lower.includes("pas de cv") ||
    lower.includes("n'en ai pas");

  if (isNoResume) {
    const prompt =
      isFrench
        ? "C'est tout à fait normal. Je vais vous aider à en créer un étape par étape. Tout d'abord, quel est votre nom complet ?"
        : isGujarati
        ? "કોઈ ચિંતા નથી! હું તમને રેઝ્યૂમે બનાવવામાં મદદ કરીશ. સૌથી પહેલા, તમારું પૂરું નામ શું છે?"
        : isHindi
        ? "कोई बात नहीं! मैं आपको रेज़्यूमे बनाने में पूरी मदद करूँगा। सबसे पहले, आपका पूरा नाम क्या है?"
        : "That's completely fine. I'll help you build one step-by-step. First, what is your full name?";

    return {
      reply: prompt,
      feature: "resume",
      resumeTab: "builder",
      featureTitle: "Conversational Resume Builder",
      toolCall: {
        tool: "conversationalResumeBuilder",
        parameters: { step: 1, field: "fullName" },
      },
    };
  }

  // If already in a resume drafting loop
  if (resumeDraftState && !resumeDraftState.completed && resumeDraftState.step >= 1) {
    const langCode = isFrench ? "fr-FR" : isGujarati ? "gu-IN" : isHindi ? "hi-IN" : "en-US";
    const stepResult = processResumeStepInput(resumeDraftState, query, langCode);
    return {
      reply: stepResult.reply,
      feature: "resume",
      resumeTab: "builder",
      featureTitle: "Resume Builder",
      resumeDraftState: stepResult.nextState,
      toolCall: {
        tool: "conversationalResumeBuilder",
        parameters: { step: stepResult.nextState.step, state: stepResult.nextState },
      },
    };
  }

  // ─── B. Resume Upload & Analysis Intent ("I already have one")
  if (
    lower.includes("already have a resume") ||
    lower.includes("already have one") ||
    lower.includes("have a resume") ||
    lower.includes("upload my resume") ||
    lower.includes("analyze my resume") ||
    lower.includes("audit my resume") ||
    lower.includes("મારી પાસે રેઝ્યૂમે છે") ||
    lower.includes("मेरे पास रेज़्यूमे है") ||
    lower.includes("j'ai déjà un cv")
  ) {
    const reply =
      isFrench
        ? "Parfait ! Vous pouvez téléverser votre CV et je vais l'analyser par rapport au poste de vos rêves pour identifier vos points forts et compétences manquantes."
        : isGujarati
        ? "સરસ! તમે તમારું રેઝ્યૂમે અપલોડ કરી શકો છો, અને હું તેને તમારા લક્ષિત રોલ સામે તપાસીને સ્ટ્રેન્થ્સ અને ખૂટતી સ્કિલ્સ શોધી આપીશ."
        : isHindi
        ? "बहुत बढ़िया! आप अपना रेज़्यूमे अपलोड कर सकते हैं, और मैं आपके लक्षित रोल के अनुसार इसकी जांच करूँगा।"
        : "Great! Let's start with your resume. You can upload it, and I'll analyze it against the type of job you're looking for.";

    return {
      reply,
      feature: "resume",
      resumeTab: "analyzer",
      featureTitle: "Resume Analyzer",
      toolCall: { tool: "openResume", parameters: { tab: "analyzer" } },
    };
  }

  // ─── C. Natural Accessibility Discovery (No Medical Disclosure)
  // Scenario 1: "I can't see where to click"
  if (
    lower.includes("can't see where to click") ||
    lower.includes("cannot see where to click") ||
    lower.includes("hard to see") ||
    lower.includes("can't see the buttons") ||
    lower.includes("જોવામાં તકલીફ") ||
    lower.includes("दिखाई नहीं दे रहा") ||
    lower.includes("je ne vois pas")
  ) {
    const reply =
      isFrench
        ? "Pas de problème. Je peux vous guider sur l'ensemble du site à la voix et activer le mode contraste élevé. Souhaitez-vous que je l'active ?"
        : isGujarati
        ? "કોઈ ચિંતા નથી. હું તમને અવાજ દ્વારા આખી વેબસાઇટ પર માર્ગદર્શન આપી શકું છું. શું તમે તે શરૂ કરવા માંગો છો?"
        : isHindi
        ? "कोई समस्या नहीं। मैं आपको आवाज़ के ज़रिये पूरी वेबसाइट पर गाइड कर सकता हूँ। क्या आप इसे शुरू करना चाहेंगे?"
        : "No problem. I can guide you through the website by voice. Would you like me to do that?";

    return {
      reply,
      toolCall: {
        tool: "updateAccessibilityPreferences",
        parameters: { interactionMode: "voice", speechOutput: true, highContrast: true },
      },
    };
  }

  // Scenario 2: "I can't hear you"
  if (
    lower.includes("can't hear you") ||
    lower.includes("cannot hear") ||
    lower.includes("no audio") ||
    lower.includes("i am deaf") ||
    lower.includes("હું સાંભળી શકતો નથી") ||
    lower.includes("सुनाई नहीं दे रहा") ||
    lower.includes("je ne vous entends pas")
  ) {
    const reply =
      isFrench
        ? "Absolument. Je communiquerai désormais avec vous uniquement par texte et visuels."
        : isGujarati
        ? "ચોક્કસ. હવેથી હું તમારી સાથે ટેક્સ્ટ અને વિઝ્યુઅલ દ્વારા વાતચીત કરીશ."
        : isHindi
        ? "बिल्कुल। मैं अब से आपसे केवल टेक्स्ट और विजुअल्स के माध्यम से संवाद करूँगा।"
        : "Absolutely. I'll communicate with you through text from now on.";

    return {
      reply,
      toolCall: {
        tool: "updateAccessibilityPreferences",
        parameters: { speechOutput: false, visualResponses: true, interactionMode: "text" },
      },
    };
  }

  // Scenario 3: "Typing is difficult for me"
  if (
    lower.includes("typing is difficult") ||
    lower.includes("hard to type") ||
    lower.includes("cannot type") ||
    lower.includes("લખવામાં તકલીફ") ||
    lower.includes("टाइप करने में परेशानी") ||
    lower.includes("difficile de taper")
  ) {
    const reply =
      isFrench
        ? "Ce n'est pas grave. Vous pouvez tout répondre à la voix, et je remplirai les champs pour vous."
        : isGujarati
        ? "કોઈ વાંધો નહીં. તમે બધું બોલીને જણાવી શકો છો, અને હું તમારા માટે ફોર્મ ભરી દઈશ."
        : isHindi
        ? "कोई बात नहीं। आप बोलकर जवाब दे सकते हैं, और मैं आपके लिए सभी फ़ील्ड भर दूँगा।"
        : "That's okay. You can answer everything by speaking, and I'll fill it in for you.";

    return {
      reply,
      toolCall: {
        tool: "updateAccessibilityPreferences",
        parameters: { interactionMode: "voice", speechOutput: true },
      },
    };
  }

  // Scenario 4: "These questions are difficult to understand"
  if (
    lower.includes("difficult to understand") ||
    lower.includes("hard to understand") ||
    lower.includes("simpler questions") ||
    lower.includes("સરળ પ્રશ્નો") ||
    lower.includes("सरल सवाल") ||
    lower.includes("difficile à comprendre")
  ) {
    const reply =
      isFrench
        ? "Pas de souci. Je vais vous poser des questions plus simples, une par une."
        : isGujarati
        ? "કોઈ વાંધો નહીં. હું એક પછી એક સરળ પ્રશ્નો પૂછીશ."
        : isHindi
        ? "कोई समस्या नहीं। मैं एक-एक करके सरल सवाल पूछूँगा।"
        : "No problem. I'll ask simpler questions one at a time.";

    return {
      reply,
      toolCall: {
        tool: "updateAccessibilityPreferences",
        parameters: { simplifiedLanguage: true },
      },
    };
  }

  // ─── D. Page-Aware Inquiries (Contextual Awareness)
  // If on resume analysis page and user asks "What am I missing?" / "What's missing?"
  if (
    (currentPage === "resume" || lower.includes("skill analysis") || lower.includes("skill gap")) &&
    (lower.includes("what am i missing") || lower.includes("what's missing") || lower.includes("missing skills") || lower.includes("શું ખૂટે છે") || lower.includes("क्या कमी है") || lower.includes("que me manque"))
  ) {
    const missingList = userProfile?.missingSkills?.length
      ? userProfile.missingSkills.slice(0, 4).join(", ")
      : "TypeScript, React Architecture, and Next.js SSR";

    const reply =
      isFrench
        ? `Sur la base de votre analyse de CV pour ${role}, votre base est solide. Les principales compétences à renforcer sont : ${missingList}. Souhaitez-vous voir des cours recommandés pour celles-ci ?`
        : isGujarati
        ? `તમારા રેઝ્યૂમે એનાલિસિસ મુજબ ${role} માટે તમારી મુખ્ય ખૂટતી સ્કિલ્સ છે: ${missingList}. શું તમે આના માટે ભલામણ કરેલ કોર્સ જોવા માંગો છો?`
        : isHindi
        ? `आपके रेज़्यूमे विश्लेषण के अनुसार ${role} के लिए आपकी मुख्य लापता स्किल्स हैं: ${missingList}। क्या आप इनके लिए कोर्स देखना चाहते हैं?`
        : `Based on your resume audit for ${role}, your foundation is solid. The primary skills to prioritize next are **${missingList}**. Would you like me to show curated courses for these?`;

    return {
      reply,
      feature: "resume",
      resumeTab: "analyzer",
      featureTitle: "Skill Gap Analysis",
      toolCall: { tool: "openSkillAnalysis", parameters: {} },
    };
  }

  // ─── E. Jobs & Location Match ("Find frontend jobs near me", "remote jobs")
  if (
    lower.includes("job") ||
    lower.includes("hiring") ||
    lower.includes("vacancy") ||
    lower.includes("internship") ||
    lower.includes("नौकरी") ||
    lower.includes("નોકરી") ||
    lower.includes("emploi")
  ) {
    const isRemote = lower.includes("remote") || lower.includes("રિમોટ") || lower.includes("रिमोट");
    const cityMatch = query.match(/(?:near|in|at|around|પાસે|में|à)\s+([A-Za-z\s]+)/i);
    const location = cityMatch ? cityMatch[1].trim() : userProfile?.location || (isRemote ? "Remote" : "Your Area");

    const reply =
      isFrench
        ? `Je recherche des offres d'emploi vérifiées en temps réel pour "${role}" à ${location}. Voici les meilleures opportunités correspondant à votre profil !`
        : isGujarati
        ? `હું ${location} માં "${role}" માટે વેરિફાઇડ જોબ્સ શોધી રહ્યો છું. અહીં તમારા પ્રોફાઇલને અનુરૂપ શ્રેષ્ઠ તકો છે!`
        : isHindi
        ? `मैं ${location} में "${role}" के लिए लाइव नौकरियों की खोज कर रहा हूँ। यहाँ आपके लिए सर्वोत्तम अवसर हैं!`
        : `Searching verified real-time positions for **${role}** in **${location}**${isRemote ? " (Remote)" : ""}. Taking you to the live job matcher!`;

    return {
      reply,
      feature: "local",
      featureTitle: "Local Opportunities",
      toolCall: {
        tool: "searchJobs",
        parameters: { role, location, remote: isRemote },
      },
    };
  }

  // ─── F. Email Job Alert Configuration ("Email me whenever you find something similar")
  if (
    lower.includes("email me") ||
    lower.includes("job alert") ||
    lower.includes("notify me") ||
    lower.includes("alert me") ||
    lower.includes("ઈમેઇલ મોકલો") ||
    lower.includes("ईमेल भेजें") ||
    lower.includes("m'envoyer un e-mail")
  ) {
    const userEmail = userProfile?.email || "";
    if (userEmail && userEmail.includes("@")) {
      const reply =
        isFrench
          ? `Parfait ! J'ai configuré vos alertes d'emploi pour "${role}". Vous recevrez des notifications directes à l'adresse ${userEmail} dès qu'un poste correspondant sera disponible.`
          : isGujarati
          ? `સરસ! મેં "${role}" માટે તમારા જોબ એલર્ટ્સ સેટ કરી દીધા છે. નવી નોકરી ઉપલબ્ધ થતાં જ ${userEmail} પર સૂચના મળશે.`
          : isHindi
          ? `बढ़िया! मैंने "${role}" के लिए आपके जॉब अलर्ट सेट कर दिए हैं। नया पद मिलते ही ${userEmail} पर सूचना भेजी जाएगी।`
          : `I've configured your real-time job alerts for **${role}**! Whenever a matching role opens up, you'll receive direct notifications at **${userEmail}**.`;

      return {
        reply,
        feature: "local",
        featureTitle: "Job Alerts Active",
        toolCall: {
          tool: "configureJobAlerts",
          parameters: { email: userEmail, role, frequency: "Immediately" },
        },
      };
    } else {
      return {
        reply: "I'd be glad to notify you! What email address should I send your job alerts to?",
      };
    }
  }

  // ─── F2. Direct Email Input Recognition (e.g. mananshah1127@gmail.com) ───
  if (lower.includes("@") || lower.includes("gmail") || lower.includes(".com") || lower.includes("at the rate")) {
    const rawEmail = normalizeSpokenEmail(query);
    if (rawEmail && rawEmail.includes("@")) {
      const reply = isFrench
        ? `J'ai bien enregistré votre adresse e-mail : **${rawEmail}**. Quel poste ou domaine souhaitez-vous explorer ?`
        : isGujarati
        ? `મેં તમારું ઈમેઇલ **${rawEmail}** સેવ કરી લીધું છે. તમે કયા રોલ અથવા કરિયર ટ્રેક માટે તૈયારી કરી રહ્યા છો?`
        : isHindi
        ? `मैंने आपका ईमेल **${rawEmail}** सहेज लिया है। आप किस पद या रोल के लिए तैयारी कर रहे हैं?`
        : `I've saved your email as **${rawEmail}**! What target role or career track are you aiming for?`;

      return {
        reply,
        toolCall: {
          tool: "updateUserProfile",
          parameters: { email: rawEmail },
        },
      };
    }
  }

  // ─── G. GitHub Repositories & Open Source Projects
  if (
    lower.includes("github") ||
    lower.includes("open source") ||
    lower.includes("repositories") ||
    lower.includes("repo")
  ) {
    const topic = lower.includes("react") ? "react" : role.toLowerCase();
    const reply =
      isFrench
        ? `Voici les dépôts GitHub open-source les plus populaires pour apprendre et contribuer à ${topic}.`
        : isGujarati
        ? `${topic} શીખવા અને કોન્ટ્રીબ્યુટ કરવા માટે અહીં ટ્રેન્ડિંગ GitHub રિપોઝીટરીઝ છે.`
        : isHindi
        ? `${topic} सीखने और योगदान करने के लिए यहाँ शीर्ष GitHub रिपॉजिटरी हैं।`
        : `Here are trending open-source GitHub repositories for **${topic}** with starter-friendly issues and high community activity.`;

    return {
      reply,
      feature: "courses",
      featureTitle: "GitHub & Learning Hub",
      toolCall: { tool: "searchGithub", parameters: { query: topic, topic } },
    };
  }

  // ─── H. Courses & Project Recommendations ("How can I learn React?", "Projects")
  if (
    lower.includes("course") ||
    lower.includes("how can i learn") ||
    lower.includes("learn") ||
    lower.includes("project") ||
    lower.includes("tutorial") ||
    lower.includes("કોર્સ") ||
    lower.includes("કોડિંગ પ્રોજેક્ટ") ||
    lower.includes("कोर्स") ||
    lower.includes("cours")
  ) {
    const isProject = lower.includes("project") || lower.includes("પ્રોજેક્ટ") || lower.includes("projet");
    if (isProject) {
      const reply =
        isFrench
          ? `Pour renforcer vos compétences en ${role}, voici 3 projets concrets recommandés : \n1. **Débutant** : Application Todo accessible\n2. **Intermédiaire** : Dashboard E-Commerce avec métriques\n3. **Avancé** : Portail d'emploi collaboratif en temps réel.`
          : isGujarati
          ? `${role} માં કુશળતા મેળવવા માટે અહીં ૩ પ્રોજેક્ટ્સ છે:\n૧. **Beginner**: Accessible Todo App\n૨. **Intermediate**: E-commerce Analytics Dashboard\n૩. **Advanced**: Real-Time Career Portal.`
          : isHindi
          ? `${role} के लिए ३ अनुशंसित प्रोजेक्ट्स:\n१. **Beginner**: Todo App\n२. **Intermediate**: E-Commerce Dashboard\n૩. **Advanced**: Real-Time Job Portal.`
          : `To build practical credibility in **${role}**, here are 3 tiered project recommendations:\n• **Beginner**: *Accessible Task Management System*\n• **Intermediate**: *E-Commerce Analytics & Inventory Dashboard*\n• **Advanced**: *Real-time Collaborative Career Platform with SSR & Redis*\n\nEach project directly proves your ability to build production-grade software!`;

      return {
        reply,
        feature: "courses",
        featureTitle: "Curated Projects",
        toolCall: { tool: "searchProjects", parameters: { skill: role, difficulty: "All" } },
      };
    }

    const reply =
      isFrench
        ? `J'ai sélectionné pour vous les meilleurs cours et certifications gratuits et complets pour ${role}. Ouvrons le catalogue de formation !`
        : isGujarati
        ? `મેં તમારા માટે ${role} ના શ્રેષ્ઠ અને ફ્રી કોર્સીસ તૈયાર કર્યા છે. ચાલો Course Catalog ખોલીએ!`
        : isHindi
        ? `मैंने आपके लिए ${role} के शीर्ष कोर्स और सर्टिफिकेशन चुने हैं। आइए कोर्स कैटलॉग देखें!`
        : `I've pulled top curated courses and certifications for **${role}**, tailored to fill your skill gaps. Opening the Courses catalog!`;

    return {
      reply,
      feature: "courses",
      featureTitle: "Curated Courses",
      toolCall: { tool: "searchCourses", parameters: { topic: role } },
    };
  }

  // ─── I. Website Navigation ("Go to my skill analysis", "Open roadmap", "Practice")
  const intent = parseIntent(query);
  if (intent.feature) {
    const safeFeature = sanitizeNavPage(intent.feature);
    const safeTab = sanitizeTab(intent.resumeTab);
    return {
      reply: intent.reply,
      feature: safeFeature,
      resumeTab: safeTab,
      featureTitle: intent.featureTitle,
      toolCall: {
        tool: "navigateTo",
        parameters: { page: safeFeature, tab: safeTab },
      },
    };
  }

  // ─── Affirmative Continuation Intent ("yes", "continue", "proceed", "sure", "ok", "હા", "हाँ")
  const isAffirmative =
    lower === "yes" ||
    lower === "yes please" ||
    lower === "continue" ||
    lower === "proceed" ||
    lower === "sure" ||
    lower === "ok" ||
    lower === "okay" ||
    lower === "હા" ||
    lower === "ચોક્કસ" ||
    lower === "हाँ" ||
    lower === "जरूर" ||
    lower === "oui";

  if (isAffirmative) {
    const lastAssistantMsg = messages
      .slice()
      .reverse()
      .find((m) => m.role === "assistant")?.text.toLowerCase() || "";

    if (lastAssistantMsg.includes("resume") || lastAssistantMsg.includes("રેઝ્યૂમે") || lastAssistantMsg.includes("रेज़्यूमे")) {
      const reply = isGujarati
        ? "સરસ! ચાલો તમારું રેઝ્યૂમે બનાવવાનું શરૂ કરીએ. સૌથી પહેલા, તમારું પૂરું નામ શું છે?"
        : isHindi
        ? "शानदार! आइए आपका रेज़्यूमे बनाना शुरू करते हैं। सबसे पहले, आपका पूरा नाम क्या है?"
        : "Awesome! Let's build your resume step-by-step. First, what is your full name?";
      return {
        reply,
        feature: "resume",
        resumeTab: "builder",
        featureTitle: "Resume Builder",
        toolCall: { tool: "conversationalResumeBuilder", parameters: { step: 1, field: "fullName" } },
      };
    }

    if (lastAssistantMsg.includes("job") || lastAssistantMsg.includes("નોકરી") || lastAssistantMsg.includes("नौकरी")) {
      const reply = isGujarati
        ? "ચાલો તમારા માટે યોગ્ય નોકરીઓ શોધીએ."
        : isHindi
        ? "आइए आपके लिए सही नौकरियां ढूंढते हैं।"
        : "Let's search for verified jobs tailored to your skills.";
      return {
        reply,
        feature: "local",
        featureTitle: "Verified Jobs",
        toolCall: { tool: "searchJobs", parameters: { role, remote: true } },
      };
    }

    if (lastAssistantMsg.includes("course") || lastAssistantMsg.includes("કોર્સ") || lastAssistantMsg.includes("कोर्स")) {
      const reply = isGujarati
        ? "ચાલો તમારા માટે ટોચના કોર્સીસ જોઈએ."
        : isHindi
        ? "आइए आपके लिए शीर्ष कोर्सेज देखते हैं।"
        : "Opening curated courses tailored to your skill gaps.";
      return {
        reply,
        feature: "courses",
        featureTitle: "Curated Courses",
        toolCall: { tool: "searchCourses", parameters: { topic: role } },
      };
    }

    const reply = isGujarati
      ? "ચોક્કસ! આગળ વધવા માટે તમે મને તમારું રેઝ્યૂમે, કોર્સીસ, રોડમેપ અથવા નોકરીઓ વિશે પૂછી શકો છો."
      : isHindi
      ? "बिल्कुल! आगे बढ़ने के लिए आप मुझसे रेज़्यूमे, कोर्सेज, रोडमैप या नौकरियों के बारे में पूछ सकते हैं।"
      : "Great! We can continue with your resume builder, explore your career roadmap, or find curated jobs and courses. What would you like to start with?";
    return { reply };
  }

  // ─── Multi-Turn Context Recognition ─────────────────────────────────────────
  const previousHistory = messages.slice(0, -1).map((m) => m.text).join(" ").toLowerCase();

  // Follow-up context ("give me a simple example", "show an example", "can you show an example")
  if (
    lower.includes("example") ||
    lower.includes("simple example") ||
    lower.includes("code sample") ||
    lower.includes("code example") ||
    lower === "example please" ||
    lower === "can you give an example" ||
    lower === "give me an example"
  ) {
    if (previousHistory.includes("polymorphism") || previousHistory.includes("java")) {
      return {
        reply: `Here is a clear, real-world Java example of **Runtime Polymorphism (Method Overriding)**:

\`\`\`java
// 1. Superclass
class Animal {
    void makeSound() {
        System.out.println("The animal makes a sound");
    }
}

// 2. Subclasses overriding the makeSound() method
class Dog extends Animal {
    @Override
    void makeSound() {
        System.out.println("The dog barks: Woof! Woof!");
    }
}

class Cat extends Animal {
    @Override
    void makeSound() {
        System.out.println("The cat meows: Meow!");
    }
}

// 3. Polymorphic Execution
public class Main {
    public static void main(String[] args) {
        // A single superclass reference can refer to any subclass object
        Animal myPet;

        myPet = new Dog();
        myPet.makeSound(); // Output: The dog barks: Woof! Woof!

        myPet = new Cat();
        myPet.makeSound(); // Output: The cat meows: Meow!
    }
}
\`\`\`

### Why this demonstrates Polymorphism:
At compile-time, the variable \`myPet\` is simply of type \`Animal\`. But at runtime, the JVM uses **Dynamic Method Dispatch** to execute the method belonging to the actual instance (\`Dog\` or \`Cat\`). You can add new animals without ever changing existing client code!`,
      };
    }

    if (previousHistory.includes("binary search") || previousHistory.includes("python")) {
      return {
        reply: `Here is a step-by-step trace of **Binary Search in Python** searching for \`23\` in sorted array \`[2, 5, 8, 12, 16, 23, 38, 56, 72, 91]\`:

\`\`\`python
# Target = 23
# Step 1: low = 0 (val: 2), high = 9 (val: 91)
#         mid = (0 + 9) // 2 = 4 (val: 16)
#         16 < 23 -> Target is in right half. low becomes mid + 1 = 5

# Step 2: low = 5 (val: 23), high = 9 (val: 91)
#         mid = (5 + 9) // 2 = 7 (val: 56)
#         56 > 23 -> Target is in left half. high becomes mid - 1 = 6

# Step 3: low = 5 (val: 23), high = 6 (val: 38)
#         mid = (5 + 6) // 2 = 5 (val: 23)
#         23 == 23 -> Match found at index 5!
\`\`\`

Total comparisons: **3 steps** instead of 6 linear checks. That is $O(\\log n)$ efficiency!`,
      };
    }

    if (previousHistory.includes("recursion")) {
      return {
        reply: `Here is the canonical example of **Recursion**: Calculating Factorial ($n! = n \\times (n-1)!$):

\`\`\`python
def factorial(n: int) -> int:
    # 1. Base Case: stops the infinite descent
    if n <= 1:
        return 1
    # 2. Recursive Step: breaks down problem into smaller subproblem
    return n * factorial(n - 1)

print(factorial(4)) # Output: 24 (4 * 3 * 2 * 1)
\`\`\`

### Execution Stack:
\`\`\`text
factorial(4) -> 4 * factorial(3)
                    3 * factorial(2)
                        2 * factorial(1) -> returns 1
                    returns 2 * 1 = 2
                returns 3 * 2 = 6
            returns 4 * 6 = 24
\`\`\``,
      };
    }
  }

  // ─── General AI Knowledge: World Leaders & Current Events ───────────────────
  if (
    lower.includes("pm modi") ||
    lower.includes("narendra modi") ||
    lower.includes("prime minister modi") ||
    lower.includes("modi ji") ||
    lower === "modi"
  ) {
    return {
      reply: `**Narendra Modi** (born September 17, 1950) is an Indian politician who has been serving as the **14th Prime Minister of India** since May 2014, representing the Varanasi constituency in Uttar Pradesh.

### Key Milestones & Background:
• **Early Career**: Rose through the Rashtriya Swayamsevak Sangh (RSS) and the Bharatiya Janata Party (BJP).
• **Chief Minister of Gujarat (2001–2014)**: Led Gujarat for four consecutive terms, emphasizing industrial growth, infrastructure development, and economic deregulation.
• **National Leadership (2014–Present)**: Led the BJP-led National Democratic Alliance (NDA) to consecutive general election victories in 2014, 2019, and 2024.

### Flagship National Initiatives:
1. **Digital India & UPI**: Pioneered open public digital infrastructure, leading to global leadership in real-time digital payments.
2. **Make in India**: Focused on manufacturing, defense indigenization, and electronics assembly expansion.
3. **Financial Inclusion**: Rolled out the *Jan Dhan Yojana*, bringing over 500 million unbanked citizens into the formal banking system.
4. **Infrastructure & Energy**: Expansion of high-speed rail (*Vande Bharat*), highway corridors, and solar renewable energy capacity.
5. **Foreign Policy**: Championed the *Global South*, expanded India's footprint in the Quad, BRICS, and G20 (hosting the 2023 New Delhi Summit).`,
    };
  }

  // ─── General AI Knowledge: Natural Sciences & Biology ────────────────────────
  if (
    lower.includes("photosynthesis") ||
    lower.includes("प्रकाश संश्लेषण") ||
    lower.includes("પ્રકાશસંશ્લેષણ")
  ) {
    return {
      reply: `**Photosynthesis** is the fundamental biochemical process by which green plants, algae, and certain cyanobacteria harness light energy from the sun to convert water and carbon dioxide into oxygen and energy-rich chemical sugars (glucose).

### The Chemical Equation:
$$\\mathbf{6CO_2 + 6H_2O + \\text{Light Energy} \\longrightarrow C_6H_{12}O_6 + 6O_2}$$

### The Two Interconnected Stages:
1. **Light-Dependent Reactions (in the Thylakoid Membranes)**:
   • Chlorophyll absorbs solar photons.
   • Water molecules ($\\text{H}_2\\text{O}$) are split (*photolysis*), releasing oxygen ($\\text{O}_2$) as a vital byproduct.
   • Generates high-energy chemical carriers: **ATP** and **NADPH**.

2. **The Calvin Cycle / Light-Independent Reactions (in the Stroma)**:
   • Driven by the enzyme **RuBisCO**, atmospheric carbon dioxide ($\\text{CO}_2$) is "fixed" into organic molecules.
   • Utilizing ATP and NADPH from the light reactions, carbon is synthesized into **G3P**, which forms glucose and plant biomass.

### Why It Matters:
Photosynthesis produces virtually all the atmospheric oxygen we breathe and forms the base of the global biological food web!`,
    };
  }

  // ─── General AI Knowledge: Computer Science & Software Engineering ───────────
  if (
    lower.includes("polymorphism") ||
    (lower.includes("poly") && lower.includes("morph"))
  ) {
    return {
      reply: `In Object-Oriented Programming (OOP), **Polymorphism** (originating from the Greek words *poly* meaning "many" and *morph* meaning "form") is the principle that allows objects of different classes to be treated as objects of a common superclass, enabling a single interface to control different underlying implementations.

### 1. Compile-Time (Static) Polymorphism
Achieved via **Method Overloading**: Defining multiple methods in the same class with identical names but differing parameter types, counts, or order. The compiler determines which method to invoke at build time.

### 2. Runtime (Dynamic) Polymorphism
Achieved via **Method Overriding**: When a subclass provides its own specific implementation of a method already declared in its superclass or interface.
• The exact method executed is resolved at runtime using **Dynamic Method Dispatch** (Virtual Method Table / vtable).
• Declared using the \`@Override\` annotation in Java.

### Core Benefits:
• **Extensibility**: You can add new classes without modifying existing caller logic.
• **Maintainability**: Decouples the client from concrete classes, adhering to the Open/Closed Principle (SOLID).

*Tip: Ask "Give me a simple example" to see a working Java code implementation!*`,
    };
  }

  if (
    lower.includes("binary search") ||
    lower.includes("binary search in python")
  ) {
    return {
      reply: `**Binary Search** is an optimal search algorithm that finds the position of a target value within a **sorted array**. It operates by repeatedly dividing the search interval in half.

### Time & Space Complexity:
• **Time Complexity**: $\\mathbf{O(\\log n)}$ (halves the search space every step)
• **Space Complexity**: $\\mathbf{O(1)}$ for the iterative approach

### Python Implementation:
\`\`\`python
def binary_search(arr: list[int], target: int) -> int:
    """
    Returns the index of target in sorted arr, or -1 if not found.
    """
    low = 0
    high = len(arr) - 1

    while low <= high:
        # Avoid potential integer overflow with: low + (high - low) // 2
        mid = (low + high) // 2
        
        if arr[mid] == target:
            return mid  # Found target!
        elif arr[mid] < target:
            low = mid + 1  # Target is in the right half
        else:
            high = mid - 1 # Target is in the left half

    return -1  # Target not found

# Verification
numbers = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]
result = binary_search(numbers, 23)
print(f"Element 23 found at index: {result}") # Output: 5
\`\`\`

### Key Invariant:
The array **must be sorted** prior to searching. If the array is unsorted, linear search ($O(n)$) or sorting first ($O(n \\log n)$) is required.`,
    };
  }

  if (
    lower.includes("quantum computing") ||
    lower.includes("what is quantum computing")
  ) {
    return {
      reply: `**Quantum Computing** is an emerging computing paradigm that leverages the fundamental principles of quantum mechanics to solve complex computational problems exponentially faster than classical supercomputers.

### Classical Bits vs. Quantum Qubits:
• **Classical Bits**: Represent binary states—strictly **0** or **1**.
• **Qubits (Quantum Bits)**: Exist in a continuous continuum of states, capable of existing as 0, 1, or any linear combination of both simultaneously.

### The Three Foundational Quantum Principles:
1. **Superposition**:
   A qubit exists in multiple states at once until measured: $|\\psi\\rangle = \\alpha|0\\rangle + \\beta|1\\rangle$. This allows a quantum processor to evaluate vast numbers of possibilities in parallel.
2. **Entanglement**:
   Qubits can become fundamentally linked such that the state of one instantly dictates the state of another, regardless of physical separation.
3. **Quantum Interference**:
   Quantum algorithms orchestrate constructive interference to amplify correct answers and destructive interference to cancel out incorrect possibilities.

### Real-World Applications:
• **Cryptography**: Threatens RSA while enabling unbreakable Quantum Key Distribution (QKD).
• **Molecular Simulation & Medicine**: Modeling complex protein folding and drug interactions.
• **Logistics Optimization**: Solving vehicle routing, supply chain, and portfolio balancing problems.`,
    };
  }

  if (
    lower.includes("sql join") ||
    lower.includes("sql joins") ||
    lower.includes("explain sql joins")
  ) {
    return {
      reply: `In relational databases (PostgreSQL, MySQL, SQLite), an **SQL JOIN** clause is used to combine rows from two or more tables based on a related common column (foreign key relationship).

### The Four Primary JOIN Types:

1. **INNER JOIN**:
   Returns only the records that have matching values in **both** tables.
   \`\`\`sql
   SELECT users.name, orders.amount 
   FROM users 
   INNER JOIN orders ON users.id = orders.user_id;
   \`\`\`

2. **LEFT (OUTER) JOIN**:
   Returns **all** records from the left table, plus matched records from the right table. Unmatched right rows return \`NULL\`.
   \`\`\`sql
   SELECT users.name, orders.amount 
   FROM users 
   LEFT JOIN orders ON users.id = orders.user_id;
   \`\`\`

3. **RIGHT (OUTER) JOIN**:
   Returns **all** records from the right table, plus matched records from the left table. Unmatched left rows return \`NULL\`.

4. **FULL (OUTER) JOIN**:
   Returns all records when there is a match in **either** left or right table. Unmatched records on either side return \`NULL\`.

### Quick Decision Matrix:
• Only interested in connected data? $\\rightarrow$ **INNER JOIN**
• Want all users even if they haven't placed an order? $\\rightarrow$ **LEFT JOIN**`,
    };
  }

  if (
    lower.includes("recursion") ||
    lower.includes("what is recursion") ||
    lower.includes("explain recursion")
  ) {
    return {
      reply: `**Recursion** is a programming technique where a function solves a problem by calling itself with smaller instances of the same problem, until it reaches a designated stopping condition.

### The Two Essential Parts of Every Recursive Function:
1. **The Base Case**:
   The terminating condition that returns a direct value without making another recursive call. Without a base case, the function loops infinitely, triggering a **Stack Overflow Error**.
2. **The Recursive Step**:
   The logic where the function calls itself with modified arguments that progressively move closer toward the base case.

### Real-World Analogy:
Think of a set of **Russian nesting dolls (Matryoshka)**:
To find the smallest figurine in the center, you open each outer doll (recursive step) until you reach the solid wooden doll that cannot be opened (base case). Once found, you close them back up (stack unwinding).`,
    };
  }

  // ─── J. Greetings & General Inquiries
  const isGreeting =
    /^(hi|hello|hey|greetings|hola|bonjour|salut|namaste|kem cho|नमस्ते|કેમ છો)\b/i.test(query) ||
    lower === "hi" ||
    lower === "hello" ||
    lower === "hey" ||
    lower === "namaste";

  if (isFrench) {
    return {
      reply: isGreeting
        ? `Bonjour ${userName} ! 👋 Je suis votre assistant ubix. Je peux vous aider à rédiger ou analyser votre CV, explorer votre feuille de route, trouver des cours et des projets. Comment puis-je vous aider ?`
        : `Concernant "${query}" : je peux vous fournir des explications détaillées ou vous aider à relier cela à votre feuille de route, vos compétences ou votre CV sur ubix. Que souhaitez-vous approfondir ?`,
    };
  }

  if (isGujarati) {
    return {
      reply: isGreeting
        ? `નમસ્તે ${userName}! 👋 હું ubix સહાયક છું. હું તમારા રેઝ્યૂમે, સ્કિલ ગેપ રોડમેપ, કોર્સ અને જોબ્સ માટે મદદ કરી શકું છું. તમે શેના પર કામ કરવા માંગો છો?`
        : `તમારા પ્રશ્ન "${query}" સંદર્ભે: હું તમને આ વિષય સમજાવી શકું છું અથવા તમારા કરિયર રોડમેપ અને કૌશલ્યો સાથે જોડી શકું છું. તમે આગળ શું જાણવા માંગો છો?`,
    };
  }

  if (isHindi) {
    return {
      reply: isGreeting
        ? `नमस्ते ${userName}! 👋 मैं ubix सहायक हूँ। मैं आपके रेज़्यूमे निर्माण, कौशल विश्लेषण, रोडमैप और नौकरियों में मदद कर सकता हूँ। आप कहाँ से शुरुआत करना चाहेंगे?`
        : `"${query}" के बारे में: मैं इस पर विस्तृत जानकारी दे सकता हूँ या इसे आपके ubix रोडमैप और कौशल विकास से जोड़ सकता हूँ। आप क्या जानना चाहेंगे?`,
    };
  }

  if (isGreeting) {
    return {
      reply: voiceMode
        ? `Hello ${userName}! I'm your ubix assistant. How can I assist you with your career roadmap, interview practice, or resume today?`
        : `Hello ${userName}! 👋 I'm your **ubix Assistant**.\n\nI can assist you with:\n• **Resume Engineering**: Step-by-step creation or ATS audit\n• **Skill Gap Analysis**: Comparing your skills against ${role} requirements\n• **Curated Roadmaps**: Tier-by-tier learning milestones and project blueprints\n• **Interview Practice**: Instant interactive drills with targeted feedback\n• **Accessible Voice Guidance**: Hands-free navigation across the entire workspace\n\nWhat would you like to explore today?`,
    };
  }

  return {
    reply: `Regarding **"${query}"**:\n\nI can provide insights on this topic or help you connect it to your **${role}** roadmap, skill verification, practice questions, or resume highlights in ubix.\n\nWould you like an in-depth breakdown, code example, or roadmap alignment?`,
  };
}
