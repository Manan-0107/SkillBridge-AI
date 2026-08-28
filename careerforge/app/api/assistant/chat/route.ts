/**
 * POST /api/assistant/chat
 *
 * Real LLM Backend for CareerForge AI Copilot.
 * - Powered by Google Gemini 1.5 Flash when GEMINI_API_KEY is configured.
 * - Includes an empathetic, intelligent career mentor system prompt.
 * - Intelligently detects user intent to suggest workspace tools (Resume, Roadmap, Courses, Practice, Local).
 * - Falls back to a smart conversational reasoning engine if no key is configured.
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

    // ─── 1. Check if Gemini API Key is Available ──────────────────────────────
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey && apiKey.trim().length > 5) {
      try {
        const geminiResponse = await callGeminiLLM(apiKey, messages, userName, role);
        if (geminiResponse) {
          return NextResponse.json(geminiResponse);
        }
      } catch (geminiErr) {
        console.error("[Assistant API] Gemini call error:", geminiErr);
        // Fall through to smart reasoning engine
      }
    }

    // ─── 2. Smart Built-in Conversational Engine (Fallback) ───────────────────
    const fallbackResponse = generateSmartResponse(lastMessage, userName, role);
    return NextResponse.json(fallbackResponse);
  } catch (error) {
    console.error("[Assistant API] Error:", error);
    return NextResponse.json(
      {
        reply: "I'm here to support you. Could you rephrase or tell me which area of your career you'd like to explore?",
        feature: null,
      },
      { status: 500 }
    );
  }
}

// ─── Gemini LLM Integration ───────────────────────────────────────────────────
async function callGeminiLLM(
  apiKey: string,
  messages: ChatMessage[],
  userName: string,
  role: string
) {
  const systemPrompt = `You are CareerForge Copilot, a warm, highly empathetic, and insightful AI career advisor and mentor.
You are assisting ${userName}, whose target career track is ${role}.

YOUR CORE ATTRIBUTES:
- Empathetic, supportive, encouraging, and clear.
- Provide thoughtful, personalized, actionable career advice, technical learning guidance, resume strategies, and interview coaching.
- Especially considerate and accessible for users with disabilities, career transitions, or feeling overwhelmed.
- Keep your answers concise, practical, and conversational (1 to 3 short paragraphs). Avoid overwhelming walls of text.

CAREERFORGE WORKSPACE TOOLS YOU CAN RECOMMEND:
If the user's message clearly relates to one of these tools, add an action tag at the very end of your response:
1. Resume Builder -> [ACTION: {"feature": "resume", "resumeTab": "builder", "featureTitle": "Resume Builder"}]
2. Resume Personalizer -> [ACTION: {"feature": "resume", "resumeTab": "personalizer", "featureTitle": "Resume Personalizer"}]
3. Resume ATS Analyzer -> [ACTION: {"feature": "resume", "resumeTab": "analyzer", "featureTitle": "Resume Analyzer"}]
4. Career Roadmap -> [ACTION: {"feature": "roadmap", "featureTitle": "Career Roadmap"}]
5. Curated Courses -> [ACTION: {"feature": "courses", "featureTitle": "Curated Courses"}]
6. Interview Practice -> [ACTION: {"feature": "practice", "featureTitle": "Interview Practice"}]
7. Local Opportunities -> [ACTION: {"feature": "local", "featureTitle": "Local Opportunities"}]

Format: If recommending a tool, place the [ACTION: ...] tag on its own line at the end.`;

  // Format conversation history for Gemini
  const contents = [
    {
      role: "user",
      parts: [{ text: systemPrompt }],
    },
    {
      role: "model",
      parts: [{ text: `Understood. I am CareerForge Copilot, ready to support ${userName} with warmth, clarity, and actionable guidance.` }],
    },
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
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 600,
        },
      }),
      signal: AbortSignal.timeout(12000),
    }
  );

  if (!res.ok) {
    throw new Error(`Gemini API returned status ${res.status}`);
  }

  const data = await res.json();
  const rawReply: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

  if (!rawReply.trim()) return null;

  // Extract optional action tag
  const actionMatch = rawReply.match(/\[ACTION:\s*({.*?})\]/);
  let reply = rawReply.replace(/\[ACTION:\s*({.*?})\]/, "").trim();
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
      // Ignore action parse error
    }
  }

  // If no action tag was returned by LLM, fall back to keyword intent check
  if (!feature) {
    const lastUserText = messages[messages.length - 1]?.text || "";
    const intent = parseIntent(lastUserText);
    if (intent.feature) {
      feature = intent.feature;
      resumeTab = intent.resumeTab;
      featureTitle = intent.featureTitle;
    }
  }

  return {
    reply,
    feature,
    resumeTab,
    featureTitle,
  };
}

// ─── Smart Conversational Fallback Engine ─────────────────────────────────────
function generateSmartResponse(rawQuery: string, userName: string, role: string) {
  const query = rawQuery.toLowerCase();
  const intent = parseIntent(rawQuery);

  // Check common conversational themes
  if (query.includes("hello") || query.includes("hi") || query.includes("hey")) {
    return {
      reply: `Hi ${userName}! Great to connect with you. I'm here to help you navigate your ${role} journey with confidence. Are you looking to sharpen your resume, explore your next learning milestones, or practice interview questions today?`,
      feature: null,
    };
  }

  if (query.includes("how are you") || query.includes("who are you")) {
    return {
      reply: `I'm doing well, thank you for asking! I'm your dedicated CareerForge AI companion. I think alongside you to solve career roadblocks, evaluate your skills, and guide your next steps with patience and clarity.`,
      feature: null,
    };
  }

  if (query.includes("nervous") || query.includes("scared") || query.includes("anxious") || query.includes("stress")) {
    return {
      reply: `It is completely natural to feel overwhelmed at times, ${userName}. Career growth is a step-by-step journey, not an all-at-once sprint. Take a deep breath — we can break down your goals into bite-sized, manageable milestones so you always feel in control.`,
      feature: "roadmap",
      featureTitle: "Career Roadmap",
    };
  }

  if (query.includes("salary") || query.includes("negotiat") || query.includes("offer")) {
    return {
      reply: `When negotiating an offer for a ${role} role, ground your conversation in the value and outcomes you deliver. Research market percentiles, highlight specialized competencies from your projects, and ask open questions like: 'What flexibility is there on the base or equity structure for this role?'`,
      feature: null,
    };
  }

  if (query.includes("disabilit") || query.includes("accommodation") || query.includes("accessible")) {
    return {
      reply: `Workplace accessibility is a fundamental right. When discussing accommodations during hiring, focus first on your strengths, achievements, and unique problem-solving perspective. You can request ergonomic setups, screen-reader parity, or asynchronous workflows during onboarding with complete confidence.`,
      feature: null,
    };
  }

  // If matched a specific workspace feature
  if (intent.feature) {
    return {
      reply: intent.reply,
      feature: intent.feature,
      resumeTab: intent.resumeTab,
      featureTitle: intent.featureTitle,
      role: intent.role,
    };
  }

  // General career advice response
  return {
    reply: `That's a thoughtful question, ${userName}. In the ${role} space, focusing on measurable project impact and consistent fundamentals gives you the strongest competitive edge. Would you like to map this into your step-by-step career roadmap or review recommended courses?`,
    feature: "roadmap",
    featureTitle: "Career Roadmap",
  };
}
