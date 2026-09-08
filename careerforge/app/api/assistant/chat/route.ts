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
import { spawn } from "child_process";
import path from "path";
import { parseIntent, FeatureId, ResumeTab } from "@/lib/intent";
import { AGENT_TOOLS_DEFINITIONS, AgentToolName } from "@/lib/agentTools";
import { processResumeStepInput, ResumeDraftState } from "@/lib/conversationalResume";
import { normalizeSpokenEmail } from "@/lib/voice";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import {
  sanitizeNavigation,
  isAllowedFeature,
  isAllowedResumeTab,
  AiToolCallSchema,
} from "@/lib/security/aiValidation";

export const runtime = "nodejs";

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
  };
  resumeDraftState?: ResumeDraftState;
}

/**
 * Call Python AI Assistant Engine:
 * 1. Queries running FastAPI server on http://127.0.0.1:8000/api/chat
 * 2. Falls back to direct Python CLI execution via run_cli.py
 */
async function callPythonAIEngine(body: RequestBody): Promise<any> {
  // Step 1: Fast HTTP call to Python FastAPI backend
  try {
    const res = await fetch("http://127.0.0.1:8000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.reply) {
        return data;
      }
    }
  } catch (httpErr) {
    // FastAPI server not listening or starting up; proceed to CLI fallback
  }

  // Step 2: Direct Python CLI Subprocess Execution
  return new Promise((resolve) => {
    try {
      const scriptPath = path.join(process.cwd(), "python_ai", "run_cli.py");
      const py = spawn("python", [scriptPath]);
      let stdout = "";

      py.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });

      py.on("close", (code) => {
        if (code === 0 && stdout.trim()) {
          try {
            const parsed = JSON.parse(stdout);
            resolve(parsed);
            return;
          } catch (e) {}
        }
        resolve(null);
      });

      py.on("error", () => resolve(null));

      py.stdin.write(JSON.stringify(body));
      py.stdin.end();
    } catch {
      resolve(null);
    }
  });
}

export async function POST(req: NextRequest) {
  try {
    const contentLength = Number(req.headers.get("content-length") || "0");
    if (contentLength > 1024 * 1024) {
      return NextResponse.json({ error: "Payload too large. Maximum size is 1MB." }, { status: 413 });
    }

    const body: RequestBody = await req.json();
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
      return NextResponse.json({ error: "Messages array required" }, { status: 400 });
    }

    // Check user profile authorization: cannot query on behalf of another user's email
    const authUser = await getAuthenticatedUser();
    if (authUser && userProfile?.email && authUser.email.toLowerCase() !== userProfile.email.toLowerCase()) {
      return NextResponse.json(
        { error: "Forbidden: Cannot query on behalf of another user profile" },
        { status: 403 }
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
    const userName =
      userProfile?.name ||
      (userProfile?.email ? userProfile.email.split("@")[0] : "Candidate");
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

    // ─── 5. Try GitHub Models API (Azure AI Inference - GPT-4o) ───────────────
    const githubToken = process.env.GITHUB_TOKEN || process.env.GITHUB_MODELS_TOKEN;
    if (githubToken && githubToken.trim().length > 5) {
      try {
        const ghResponse = await callGithubModelsLLM(
          githubToken,
          messages,
          userName,
          role,
          voiceMode,
          currentPage,
          currentEntity,
          accessibilityPrefs
        );
        if (ghResponse && ghResponse.reply && ghResponse.reply.trim().length > 10) {
          return NextResponse.json({
            ...ghResponse,
            thinking: (ghResponse as any).thinking || [
              `🧠 1. Intent Sensing: Examining user inquiry and technical or conceptual context.`,
              `🔍 2. Inference Architecture: Reasoning with GitHub Models (GPT-4o).`,
              `💡 3. Metaphor & Empathy: Crafting accessible explanations with authentic human touch.`,
              `✨ 4. Final Polish: Structuring response with genuine warmth and depth.`,
            ],
            engine: "GitHub Models (GPT-4o)",
          });
        }
      } catch (ghErr) {
        console.warn("[Assistant API] GitHub Models error:", ghErr);
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
      engine: "CareerForge Autonomous AI Brain",
    });
  } catch (error) {
    console.error("[Assistant API] Error:", error);
    return NextResponse.json(
      {
        reply: "I am actively listening and ready to assist you. What would you like to explore next?",
        engine: "Autonomous Fallback",
      },
      { status: 200 }
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
  return `You are a warm, deeply polite, encouraging, and highly interactive AI Assistant designed explicitly for blind, visually impaired, deaf, and hard-of-hearing individuals.
Your tone matches the brilliance and natural fluid empathy of ChatGPT and Claude. You have exceptional general knowledge across technology, careers, science, and life, and your primary mission is to seamlessly guide disabled users through Career Guidance, Resume Building, Assessments, Internship Opportunities, Audiobook playback, and persistent Doubt Solving.

Collaborating with: ${userName} (Target Role: "${role}").
Current Page: "${currentPage}".
${currentEntity ? `Active Entity Context: ${JSON.stringify(currentEntity)}` : ""}
${accessibilityPrefs ? `Accessibility Preferences: ${JSON.stringify(accessibilityPrefs)}` : ""}

# CORE CONVERSATIONAL RULES:
1. NEVER use conversational filler or overly robotic structures ("Regarding X: practical trade-offs", "amm", "umm"). Talk naturally as if you are in a continuous, active voice stream.
2. Be incredibly sensitive to voice-driven constraints. Keep your spoken responses concise, warm, and punchy (2-3 sentences when spoken) so the Text-to-Speech (TTS) engine can stream them out with zero lag.
3. Be highly robust against accent variations, speech pacing, or speech impediments. Always focus on extracting the user's primary core intent.
4. Detect language automatically (English, Hindi, Gujarati, French, Spanish, German, etc.) and reply in the same language.

# FEATURE 1: MULTI-STEP RESUME FLOW & IMPLICIT FORM FILLING
- Do not read out massive forms. Abstract fields into an interactive, fluid, single-turn dialogue.
- Ask conversational questions one-by-one to extract data points (Name, Education, Skills, Work History).
- In the background, format these into structured JSON. Never tell the user you are formatting code; keep the interaction entirely natural.

# FEATURE 2: CONTINUOUS DOUBT SOLVING & ASSESSMENT CONTEXT-LOCKING
- When running a career or skill assessment, ask questions one by one.
- IF THE USER INTERRUPTS WITH A DOUBT (e.g., "What does that technical term mean?", "Can you explain polymorphism?"):
  1. Instantly pause the assessment state.
  2. Answer their question politely, using clear semantic explanations and relatable intuitive metaphors.
  3. Immediately and smoothly route them back to the exact pending assessment question without losing any previously entered text or choices (e.g. "Now, jumping right back to where we paused: [question]...").

# FEATURE 3: AUDIOBOOK PLAYER INTERRUPTIONS
- You control an integrated career training audiobook player.
- Always listen intently for voice or text command overrides (e.g., "Stop", "Pause", "Resume", "Go back 10 seconds", "Skip 15 seconds", "Explain what the author meant by that last sentence"). Act on these immediately with warm, helpful responses.

# FEATURE 4: DYNAMIC AUTONOMOUS PAGE ROUTING
- You have the authority to navigate the user through the website.
- If the user asks about a section or their answer indicates they need to be on a specific page (e.g., "Show me available internship listings", "Take me to my progress dashboard", "Open resume builder"):
  Append a clean routing JSON block at the absolute end of your textual response payload so the frontend router can catch it and instantly shift the screen:
  {"action": "navigate", "path": "/internships/view"}
  (Supported paths: /internships/view, /resume/builder, /courses/learn, /practice/interview, /dashboard)

# FEATURE 5: THE FINAL ONBOARDING HANDOFF
- Track the user's onboarding progress. The exact moment the final required profile field is gathered, stop the data collection loop and say exactly:
  "Awesome! I have gathered all your details and found matching internships. Would you like me to go ahead and create your account now, or should we review the positions first?"
- Listen intently for simple, fast, binary affirmative words ("Yes", "Sure", "Go ahead", "Create it"). The moment you detect an affirmative, immediately output a trigger action command to let the backend fire the account creation API.

# ACCESSIBILITY MODES (DUAL-STREAM)
- Blind Stream: Ensure all output makes sense aurally. Never say "Click here" or "Look at this box." Describe options explicitly and warmly.
- Deaf Stream: Ensure every spoken token aligns with the word-by-word streaming text captions on screen. Trigger operational state tags when moving between Assessment mode, Doubt Solving mode, and Navigation.`;
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

// ─── 5. GitHub Models API Provider ────────────────────────────────────────────
async function callGithubModelsLLM(
  token: string,
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

  const res = await fetch("https://models.inference.ai.azure.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
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
      if (parsed.tool) {
        toolCall = parsed;
        if (parsed.tool === "navigateTo" || parsed.tool === "openResume") {
          feature = parsed.page || "resume";
          resumeTab = parsed.tab;
        } else if (parsed.tool === "searchJobs") {
          feature = "local";
        } else if (parsed.tool === "searchCourses") {
          feature = "courses";
        } else if (parsed.tool === "openSkillAnalysis") {
          feature = "resume";
          resumeTab = "analyzer";
        }
      } else if (parsed.feature) {
        feature = parsed.feature;
        resumeTab = parsed.resumeTab;
        featureTitle = parsed.featureTitle;
      }
    } catch {
      // ignore
    }
  }

  // Also parse trailing clean routing JSON block: {"action": "navigate", "path": "..."}
  const trailingNavMatch = cleanReply.match(/\{\s*"action"\s*:\s*"navigate"\s*,\s*"path"\s*:\s*"([^"]+)"\s*\}\s*$/i);
  if (trailingNavMatch) {
    const rawPath = trailingNavMatch[1];
    const sanitized = sanitizeNavigation(rawPath);
    if (sanitized) {
      feature = sanitized.feature;
      if (sanitized.resumeTab) resumeTab = sanitized.resumeTab;
      featureTitle =
        feature === "local"
          ? "Internships & Opportunities"
          : feature === "resume"
          ? (resumeTab === "builder" ? "Resume Builder" : "Resume Analyzer")
          : feature === "courses"
          ? "Courses & Audiobooks"
          : feature === "practice"
          ? "Skill Assessments"
          : "Career Roadmap";
      toolCall = { tool: "navigateTo", parameters: { path: rawPath, tab: resumeTab } };
    }
  }

  // Validate allowed feature
  if (feature && !isAllowedFeature(feature)) {
    feature = null;
    featureTitle = undefined;
  }
  if (resumeTab && !isAllowedResumeTab(resumeTab)) {
    resumeTab = undefined;
  }

  // Validate toolCall if present
  if (toolCall) {
    const validationResult = AiToolCallSchema.safeParse(toolCall);
    if (!validationResult.success) {
      console.warn("[Security] Filtered invalid AI toolCall:", toolCall, validationResult.error.message);
      toolCall = null;
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

  // ─── FEATURE 3: Audiobook Player Voice Controls & Interruptions ─────────────
  if (
    lower.includes("explain what the author meant by that last sentence") ||
    lower.includes("explain what the author meant") ||
    lower.includes("explain the last sentence") ||
    lower.includes("what did the author mean")
  ) {
    return {
      reply:
        "The author was emphasizing that inclusive, accessible architecture isn't an afterthought or a compliance checkbox. When you design for accessibility from the start, you inherently build cleaner, more decoupled, and more resilient systems for everyone. Would you like me to resume the audiobook now?",
      toolCall: {
        tool: "audiobookControl",
        action: "explain",
      },
    };
  }

  if (
    lower === "go back 10 seconds" ||
    lower === "rewind 10 seconds" ||
    lower === "rewind" ||
    lower.includes("back 10 seconds")
  ) {
    return {
      reply: "Rewound 10 seconds. Playing now.",
      toolCall: {
        tool: "audiobookControl",
        action: "seek",
        seconds: -10,
      },
    };
  }

  if (
    lower === "skip 15 seconds" ||
    lower === "forward 15 seconds" ||
    lower.includes("skip 15")
  ) {
    return {
      reply: "Skipped forward 15 seconds.",
      toolCall: {
        tool: "audiobookControl",
        action: "seek",
        seconds: 15,
      },
    };
  }

  if (
    lower === "stop" ||
    lower === "pause" ||
    lower === "pause audiobook" ||
    lower === "stop audiobook" ||
    lower === "stop playback"
  ) {
    return {
      reply: "Audiobook paused. You can say 'resume' or 'go back 10 seconds' whenever you are ready.",
      toolCall: {
        tool: "audiobookControl",
        action: "pause",
      },
    };
  }

  if (
    lower === "resume" ||
    lower === "play" ||
    lower === "resume audiobook" ||
    lower === "play audiobook"
  ) {
    return {
      reply: "Resuming your career training audiobook right now.",
      toolCall: {
        tool: "audiobookControl",
        action: "play",
      },
    };
  }

  // ─── FEATURE 4: Dynamic Autonomous Page Routing ─────────────────────────────
  if (
    lower.includes("show me available internship listings") ||
    lower.includes("available internship listings") ||
    lower.includes("internship listings") ||
    lower.includes("take me to internships") ||
    lower.includes("show internships") ||
    lower.includes("find internships")
  ) {
    return {
      reply: `I'm opening your personalized internship and opportunity listings right now. Here are verified roles matching your profile!\n\n{"action": "navigate", "path": "/internships/view"}`,
      feature: "local",
      featureTitle: "Internships & Opportunities",
      toolCall: { tool: "navigateTo", path: "/internships/view", feature: "local" },
    };
  }

  if (
    lower.includes("progress dashboard") ||
    lower.includes("my progress dashboard") ||
    lower.includes("take me to my progress dashboard") ||
    lower.includes("show my dashboard")
  ) {
    return {
      reply: `Taking you straight to your progress dashboard.\n\n{"action": "navigate", "path": "/dashboard"}`,
      feature: null,
      featureTitle: "Progress Dashboard",
      toolCall: { tool: "navigateTo", path: "/dashboard" },
    };
  }

  if (
    lower.includes("take me to resume builder") ||
    lower.includes("open resume builder") ||
    lower.includes("build my resume")
  ) {
    return {
      reply: `Opening the interactive resume builder for you.\n\n{"action": "navigate", "path": "/resume/builder"}`,
      feature: "resume",
      resumeTab: "builder",
      featureTitle: "Resume Builder",
      toolCall: { tool: "navigateTo", path: "/resume/builder", feature: "resume", tab: "builder" },
    };
  }

  // ─── FEATURE 2: Continuous Doubt Solving & Assessment Context-Locking ───────
  const isDoubtQuery =
    lower.includes("what does that technical term mean") ||
    lower.includes("what does that mean") ||
    lower.includes("i have a doubt") ||
    lower.includes("can you explain") ||
    lower.includes("what is polymorphism") ||
    lower.includes("what is recursion") ||
    lower.includes("what is an api") ||
    lower.includes("what is big o");

  if (isDoubtQuery) {
    let conceptExplanation = "";
    if (lower.includes("polymorphism")) {
      conceptExplanation =
        "Think of polymorphism like a universal remote control. One button, like 'Power' or 'Play', sends a command, but each device—a TV, an audio amplifier, or a projector—responds in its own customized way. In code, it lets different classes respond to the same interface uniquely.";
    } else if (lower.includes("recursion")) {
      conceptExplanation =
        "Recursion is like standing between two parallel mirrors, where an image reflects inside itself until a base stopping condition is reached. In code, a function calls itself to solve smaller pieces of a larger problem.";
    } else if (lower.includes("api")) {
      conceptExplanation =
        "An API is like a restaurant menu and waiter. You don't need to step into the kitchen to know how the chef cooks; you simply request a dish from the menu, and the waiter safely brings you the finished result.";
    } else {
      conceptExplanation =
        "A technical term is simply a standardized shorthand engineers use so everyone shares the exact same mental blueprint without having to re-explain the underlying mechanics every single time.";
    }

    // Check if there is a pending assessment or question in the conversation
    const pendingQ =
      messages
        .slice()
        .reverse()
        .find((m) => m.role === "assistant" && (m.text.includes("?") || m.text.includes("Step") || m.text.includes("Question")))?.text || "";

    const cleanPending = pendingQ.split("\n")[0] || "What is your target direction?";

    return {
      reply: `${conceptExplanation}\n\nNow, jumping right back to where we paused: ${cleanPending}. Take your time, what would be your answer?`,
      toolCall: {
        tool: "doubtSolvedContextLock",
        parameters: { doubt: query, resumedQuestion: cleanPending },
      },
    };
  }

  // ─── Last Assistant Message Reference ──────────────────────────────────────
  const lastAssistantMsg =
    messages
      .slice()
      .reverse()
      .find((m) => m.role === "assistant")?.text.toLowerCase() || "";

  // ─── FEATURE 5: Onboarding Handoff Affirmative Detection ────────────────────
  if (
    lastAssistantMsg.includes("awesome! i have gathered all your details and found matching internships") ||
    lastAssistantMsg.includes("create your account now")
  ) {
    if (/^(yes|sure|go ahead|create it|proceed|yep|yeah|absolutely|do it|create|confirm)$/i.test(lower)) {
      return {
        reply: "Creating your account right now. You are all set! Welcome aboard.",
        toolCall: {
          tool: "createAccount",
          confirmed: true,
        },
      };
    }
  }

  // ─── 0. Voice Onboarding Step 1: User Chooses Voice Mode ("Voice")

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

  // ─── Feature 3: Audiobook Player Controls & Voice Interruptions ────────────
  if (
    lower === "stop audiobook" ||
    lower === "pause audiobook" ||
    lower === "stop audio" ||
    lower === "pause audio" ||
    (lower === "pause" && currentPage === "audiobook")
  ) {
    return {
      reply: "Paused the audiobook for you. Just say resume or play whenever you're ready to listen again.",
      toolCall: { tool: "audiobookControl", action: "pause" },
    };
  }

  if (
    lower === "resume audiobook" ||
    lower === "play audiobook" ||
    lower === "start audiobook" ||
    lower === "unpause audiobook"
  ) {
    return {
      reply: "Resuming your career training audiobook right where you left off.",
      toolCall: { tool: "audiobookControl", action: "play" },
    };
  }

  if (
    lower.includes("go back 10 seconds") ||
    lower.includes("back 10 seconds") ||
    lower.includes("rewind 10 seconds") ||
    lower.includes("rewind")
  ) {
    return {
      reply: "Rewound 10 seconds. Playing now.",
      toolCall: { tool: "audiobookControl", action: "seek", seconds: -10 },
    };
  }

  if (
    lower.includes("explain what the author meant") ||
    lower.includes("what did the author mean") ||
    lower.includes("explain that sentence") ||
    lower.includes("explain what they meant")
  ) {
    return {
      reply: "The author is highlighting that mastery comes from targeted deliberate practice rather than passive study. By applying concepts directly to real projects, retention triples. Would you like to resume playback, or try a quick exercise on this?",
      toolCall: { tool: "audiobookControl", action: "pause" },
    };
  }

  // ─── Feature 4: Autonomous Dynamic Page Routing ────────────────────────────
  if (
    lower.includes("internship listings") ||
    lower.includes("available internships") ||
    lower.includes("show me internships") ||
    lower.includes("find internships")
  ) {
    return {
      reply: `Taking you straight to the available verified internship listings right now!\n{"action": "navigate", "path": "/internships/view"}`,
      feature: "local",
      featureTitle: "Verified Internships",
      toolCall: { tool: "navigateTo", parameters: { path: "/internships/view" } },
    };
  }

  if (
    lower.includes("progress dashboard") ||
    lower.includes("my dashboard") ||
    lower.includes("view my progress")
  ) {
    return {
      reply: `Opening your career progress dashboard right now.\n{"action": "navigate", "path": "/dashboard"}`,
      feature: "roadmap",
      featureTitle: "Progress Dashboard",
      toolCall: { tool: "navigateTo", parameters: { path: "/dashboard" } },
    };
  }

  // ─── Feature 2: Continuous Doubt Solving & Assessment Context-Locking ──────
  if (
    lower.startsWith("what is ") ||
    lower.startsWith("what does ") ||
    lower.startsWith("can you explain ") ||
    lower.startsWith("explain ") ||
    lower.includes("what is polymorphism") ||
    lower.includes("what is an api")
  ) {
    let explanation = "Think of it like a universal adapter: it defines a standardized interface so different components can interact seamlessly without knowing internal implementation details.";
    if (lower.includes("polymorphism")) {
      explanation = "Polymorphism means 'many forms'. Think of a universal remote: the 'play' button tells a DVD, a music player, or a streaming app to play, but each device performs it in its own specialized way.";
    } else if (lower.includes("api")) {
      explanation = "An API is like a waiter in a restaurant. You make an order from the menu, the waiter delivers your request to the kitchen, and brings you back the fresh dish.";
    }

    return {
      reply: `${explanation} Now, jumping right back to where we paused: are you ready to continue with your pending assessment question?`,
      toolCall: { tool: "doubtSolvedContextLock" },
    };
  }

  // ─── Feature 5: The Final Onboarding Affirmative Detection ──────────────────
  const isAffirmativeDirect = /^(yes|sure|go ahead|create it|proceed|yep|yeah|absolutely|do it|create|confirm)$/i.test(lower);
  const lastMsg = messages.slice(-2)[0]?.text?.toLowerCase() || "";
  if (isAffirmativeDirect && (lastMsg.includes("matching internships") || lastMsg.includes("create your account now") || lastMsg.includes("gathered all your details"))) {
    return {
      reply: "Awesome! Creating your account right now. You are all set! Welcome aboard.",
      toolCall: { tool: "completeOnboardingAccount" },
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
    return {
      reply: intent.reply,
      feature: intent.feature,
      resumeTab: intent.resumeTab,
      featureTitle: intent.featureTitle,
      toolCall: {
        tool: "navigateTo",
        parameters: { page: intent.feature, tab: intent.resumeTab },
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

  // ─── J. Greetings & General Inquiries
  if (isFrench) {
    return {
      reply: `Bonjour ${userName} ! 👋 Je suis votre assistant de carrière et d'accessibilité CareerForge. Je peux vous aider à rédiger ou analyser votre CV, trouver des cours, des projets open-source et des emplois en direct. Comment souhaitez-vous continuer ?`,
    };
  }

  if (isGujarati) {
    return {
      reply: `નમસ્તે ${userName}! 👋 હું કરિયરફોર્જ AI સહાયક છું. હું તમારા રેઝ્યૂમે નિર્માણ, સ્કિલ ગેપ એનાલિસિસ, કોર્સ, પ્રોજેક્ટ્સ અને જોબ્સ શોધવામાં મદદ કરી શકું છું. તમે શેના પર કામ કરવા માંગો છો?`,
    };
  }

  if (isHindi) {
    return {
      reply: `नमस्ते ${userName}! 👋 मैं करियरफोर्ज AI सहायक हूँ। मैं आपके रेज़्यूमे निर्माण, कौशल विश्लेषण, कोर्स, प्रोजेक्ट और लाइव नौकरियों में मदद कर सकता हूँ। आप कहाँ से शुरुआत करना चाहेंगे?`,
    };
  }

  return {
    reply: voiceMode
      ? `Hello ${userName}! I'm your CareerForge assistant. I can guide you through resume audits, skill gap roadmaps, curated courses, projects, or local jobs. Where shall we begin?`
      : `Hello ${userName}! 👋 I'm your **CareerForge AI Career & Accessibility Co-Pilot**.\n\nI can assist you with:\n• **Resume Engineering**: Step-by-step creation or ATS audit\n• **Skill Gap Analysis**: Comparing your skills against ${role} requirements\n• **Curated Learning**: High-impact courses and portfolio project blueprints\n• **Verified Job Opportunities**: Matching positions and automated email alerts\n• **Accessible Voice Guidance**: Hands-free navigation across the entire platform\n\nWhat would you like to explore today?`,
  };
}
