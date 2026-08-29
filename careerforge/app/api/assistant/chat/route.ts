/**
 * POST /api/assistant/chat
 *
 * Multi-Engine Real LLM Backend for CareerForge:
 * 1. Free Open-Source LLM Engine (Pollinations.ai - LLaMA 3.3 / Mistral / OpenAI - 100% Free, NO API Key needed)
 * 2. GitHub Models API (via GITHUB_TOKEN if configured)
 * 3. Google Gemini 1.5 Flash (via GEMINI_API_KEY if configured)
 * 4. Autonomous Career Reasoning Engine (instant offline fallback)
 */

import { NextRequest, NextResponse } from "next/server";
import { parseIntent, FeatureId, ResumeTab } from "@/lib/intent";

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
  };
  targetRole?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json();
    const { messages, userProfile, targetRole } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages array required" }, { status: 400 });
    }

    const lastMessage = messages[messages.length - 1]?.text || "";
    const userName = userProfile?.name || (userProfile?.email ? userProfile.email.split("@")[0] : "Friend");
    const role = targetRole || userProfile?.targetRole || "frontend";

    // ─── 1. Try Free Open-Source LLM (Pollinations AI - LLaMA 3.3 / Mistral) ───
    try {
      const freeLlmResponse = await callFreeOpenSourceLLM(messages, userName, role);
      if (freeLlmResponse && freeLlmResponse.reply?.trim().length > 10) {
        return NextResponse.json(freeLlmResponse);
      }
    } catch (llmErr) {
      console.warn("[Assistant API] Free LLM error:", llmErr);
    }

    // ─── 2. Try GitHub Models API (if GITHUB_TOKEN is available) ───────────────
    const githubToken = process.env.GITHUB_TOKEN || process.env.GITHUB_MODELS_TOKEN;
    if (githubToken && githubToken.trim().length > 10) {
      try {
        const ghResponse = await callGithubModelsLLM(githubToken, messages, userName, role);
        if (ghResponse) {
          return NextResponse.json(ghResponse);
        }
      } catch (ghErr) {
        console.warn("[Assistant API] GitHub Models error:", ghErr);
      }
    }

    // ─── 3. Try Google Gemini (if GEMINI_API_KEY is available) ─────────────────
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey && geminiKey.trim().length > 5) {
      try {
        const geminiResponse = await callGeminiLLM(geminiKey, messages, userName, role);
        if (geminiResponse) {
          return NextResponse.json(geminiResponse);
        }
      } catch (geminiErr) {
        console.warn("[Assistant API] Gemini error:", geminiErr);
      }
    }

    // ─── 4. Smart Built-in Reasoning Fallback ───────────────────────────────────
    const fallbackResponse = generateSmartResponse(lastMessage, userName, role);
    return NextResponse.json(fallbackResponse);
  } catch (error) {
    console.error("[Assistant API] Fatal error:", error);
    return NextResponse.json(
      {
        reply: "I am here to guide your career progression. What area would you like to explore today?",
        feature: null,
      },
      { status: 500 }
    );
  }
}

// ─── 1. Free Open-Source LLM Provider (Pollinations.ai - Zero Keys Needed) ─────
async function callFreeOpenSourceLLM(
  messages: ChatMessage[],
  userName: string,
  role: string
) {
  const systemPrompt = `You are CareerForge Copilot, a helpful, empathetic, and intelligent career mentor specialized in tech careers, accessible guidance, resume building, and skill roadmaps for ${userName} (target role: ${role}).
Provide thoughtful, clear, compassionate, and practical answers. Keep responses concise and well-structured (2 to 4 paragraphs).

If the user's message strongly relates to a workspace feature, add this tag at the very end of your response on a new line:
- Resume Builder -> [ACTION: {"feature": "resume", "resumeTab": "builder", "featureTitle": "Resume Builder"}]
- Resume Personalizer -> [ACTION: {"feature": "resume", "resumeTab": "personalizer", "featureTitle": "Resume Personalizer"}]
- Resume Analyzer -> [ACTION: {"feature": "resume", "resumeTab": "analyzer", "featureTitle": "Resume Analyzer"}]
- Career Roadmap -> [ACTION: {"feature": "roadmap", "featureTitle": "Career Roadmap"}]
- Curated Courses -> [ACTION: {"feature": "courses", "featureTitle": "Curated Courses"}]
- Interview Practice -> [ACTION: {"feature": "practice", "featureTitle": "Interview Practice"}]
- Local Opportunities -> [ACTION: {"feature": "local", "featureTitle": "Local Opportunities"}]`;

  const formattedMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.text,
    })),
  ];

  const res = await fetch("https://text.pollinations.ai/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: formattedMessages,
      model: "openai",
      seed: 42,
      jsonMode: false,
    }),
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    throw new Error(`Pollinations API returned status ${res.status}`);
  }

  const rawReply = await res.text();
  if (!rawReply || rawReply.trim().length === 0) return null;

  return parseActionFromReply(rawReply, messages);
}

// ─── 2. GitHub Models API Provider ─────────────────────────────────────────────
async function callGithubModelsLLM(
  token: string,
  messages: ChatMessage[],
  userName: string,
  role: string
) {
  const systemPrompt = `You are CareerForge Copilot, an AI career mentor for ${userName} targeting ${role}. Provide encouraging, practical, and clear career advice.`;

  const res = await fetch("https://models.inference.ai.azure.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.text,
        })),
      ],
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 600,
    }),
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const rawReply: string = data?.choices?.[0]?.message?.content || "";
  if (!rawReply.trim()) return null;

  return parseActionFromReply(rawReply, messages);
}

// ─── 3. Google Gemini Provider ────────────────────────────────────────────────
async function callGeminiLLM(
  apiKey: string,
  messages: ChatMessage[],
  userName: string,
  role: string
) {
  const systemPrompt = `You are CareerForge Copilot for ${userName} targeting ${role}. Provide empathetic, concise, actionable career guidance.`;

  const contents = [
    { role: "user", parts: [{ text: systemPrompt }] },
    { role: "model", parts: [{ text: "Understood. I am CareerForge Copilot." }] },
    ...messages.map((m) => ({
      role: m.role === "user" ? "user" : "model",
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
        generationConfig: { temperature: 0.7, maxOutputTokens: 600 },
      }),
      signal: AbortSignal.timeout(12000),
    }
  );

  if (!res.ok) return null;
  const data = await res.json();
  const rawReply: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!rawReply.trim()) return null;

  return parseActionFromReply(rawReply, messages);
}

// ─── Action Parser Helper ─────────────────────────────────────────────────────
function parseActionFromReply(rawReply: string, messages: ChatMessage[]) {
  const actionMatch = rawReply.match(/\[ACTION:\s*({.*?})\]/);
  const reply = rawReply.replace(/\[ACTION:\s*({.*?})\]/, "").trim();
  let feature: FeatureId | null = null;
  let resumeTab: ResumeTab | undefined = undefined;
  let featureTitle: string | undefined = undefined;

  if (actionMatch && actionMatch[1]) {
    try {
      const parsedAction = JSON.parse(actionMatch[1]);
      feature = parsedAction.feature || null;
      resumeTab = parsedAction.resumeTab;
      featureTitle = parsedAction.featureTitle;
    } catch {
      // ignore parse errors
    }
  }

  if (!feature) {
    const lastUserText = messages[messages.length - 1]?.text || "";
    const intent = parseIntent(lastUserText);
    if (intent.feature) {
      feature = intent.feature;
      resumeTab = intent.resumeTab;
      featureTitle = intent.featureTitle;
    }
  }

  return { reply, feature, resumeTab, featureTitle };
}

// ─── 4. Built-in Conversational Reasoning Engine ──────────────────────────────
function generateSmartResponse(rawQuery: string, userName: string, role: string) {
  const query = rawQuery.toLowerCase();
  const intent = parseIntent(rawQuery);

  if (query.includes("hello") || query.includes("hi") || query.includes("hey")) {
    return {
      reply: `Hi ${userName}! Great to connect with you. I'm your CareerForge AI companion. Whether you'd like to explore your ${role} roadmap, evaluate your resume, or practice interview questions, I'm right here to support you.`,
      feature: null,
    };
  }

  if (query.includes("nervous") || query.includes("anxious") || query.includes("stress")) {
    return {
      reply: `It is completely natural to feel overwhelmed at times, ${userName}. Career development is a gradual, step-by-step process. Let's break down your goals into manageable milestones together.`,
      feature: "roadmap",
      featureTitle: "Career Roadmap",
    };
  }

  if (intent.feature) {
    return {
      reply: intent.reply,
      feature: intent.feature,
      resumeTab: intent.resumeTab,
      featureTitle: intent.featureTitle,
      role: intent.role,
    };
  }

  return {
    reply: `That's a great question, ${userName}. Focusing on deep fundamentals and high-impact projects will give you a significant advantage in the ${role} field. Would you like to view your step-by-step roadmap or practice core interview questions?`,
    feature: "roadmap",
    featureTitle: "Career Roadmap",
  };
}
