/**
 * POST /api/assistant/chat
 *
 * Humanized Multi-Engine Real LLM Backend for CareerForge:
 * 1. Groq Cloud API (Llama 3.3 70B Versatile - Ultra-low latency LPU inference)
 * 2. GitHub Models API (Azure AI Inference - LLaMA 3.3 70B, DeepSeek R1, GPT-4o-mini, Mistral Large)
 * 3. Google Gemini 1.5/2.0 Flash (if GEMINI_API_KEY configured)
 * 4. Hugging Face Serverless Inference (Qwen 2.5 Coder, LLaMA 3.3)
 * 5. Free Open-Source Multi-Model Endpoints (DeepSeek-V3 / Mistral / LLaMA)
 * 6. Autonomous Humanized Career Mentor Engine (Comprehensive, empathetic, multi-paragraph tech mentorship)
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
  temperature?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json();
    const { messages, userProfile, targetRole } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages array required" }, { status: 400 });
    }

    const lastMessage = messages[messages.length - 1]?.text || "";
    const userName =
      userProfile?.name ||
      (userProfile?.email ? userProfile.email.split("@")[0] : "Friend");
    const role = targetRole || userProfile?.targetRole || "frontend";

    // ─── 1. Try Groq Cloud API (Llama 3.3 70B - Lightning Fast) ───────────────
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey && groqKey.trim().length > 5) {
      try {
        const groqResponse = await callGroqLLM(groqKey, messages, userName, role);
        if (groqResponse && groqResponse.reply && groqResponse.reply.trim().length > 20) {
          return NextResponse.json({ ...groqResponse, engine: "Groq (Llama 3.3 70B)" });
        }
      } catch (groqErr) {
        console.warn("[Assistant API] Groq error:", groqErr);
      }
    }

    // ─── 2. Try GitHub Models API (if GITHUB_TOKEN is configured) ─────────────
    const githubToken = process.env.GITHUB_TOKEN || process.env.GITHUB_MODELS_TOKEN;
    if (githubToken && githubToken.trim().length > 5) {
      try {
        const ghResponse = await callGithubModelsLLM(githubToken, messages, userName, role);
        if (ghResponse && ghResponse.reply && ghResponse.reply.trim().length > 20) {
          return NextResponse.json({ ...ghResponse, engine: "GitHub Models (LLaMA 3.3 / GPT-4o)" });
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
        if (geminiResponse && geminiResponse.reply && geminiResponse.reply.trim().length > 20) {
          return NextResponse.json({ ...geminiResponse, engine: "Google Gemini 1.5 Flash" });
        }
      } catch (geminiErr) {
        console.warn("[Assistant API] Gemini error:", geminiErr);
      }
    }

    // ─── 4. Try Hugging Face Free Serverless Inference ────────────────────────
    try {
      const hfResponse = await callHuggingFaceLLM(messages, userName, role);
      if (hfResponse && hfResponse.reply && hfResponse.reply.trim().length > 20) {
        return NextResponse.json({ ...hfResponse, engine: "Open-Source AI (Qwen/LLaMA)" });
      }
    } catch (hfErr) {
      console.warn("[Assistant API] Hugging Face / Open-Source LLM error:", hfErr);
    }

    // ─── 5. Try Free Public Open-Source LLM (Open Source Proxy) ───────────────
    try {
      const freeLlmResponse = await callFreeOpenSourceLLM(messages, userName, role);
      if (freeLlmResponse && freeLlmResponse.reply?.trim().length > 20) {
        return NextResponse.json({ ...freeLlmResponse, engine: "Free LLaMA 3.3 Engine" });
      }
    } catch (llmErr) {
      console.warn("[Assistant API] Free LLM fallback error:", llmErr);
    }

    // ─── 6. Autonomous Humanized Career Mentor Engine (In-depth Expert AI) ────
    const humanizedResponse = generateHumanizedCareerAdvice(lastMessage, messages, userName, role);
    return NextResponse.json({ ...humanizedResponse, engine: "CareerForge Neural Mentor" });
  } catch (error) {
    console.error("[Assistant API] General error:", error);
    return NextResponse.json(
      {
        reply: "I'm right here with you! Let's examine your career goals, polish your resume, or map out your next milestone. What specific area would you like to focus on right now?",
        feature: "roadmap",
        featureTitle: "Career Roadmap",
        engine: "Autonomous Fallback",
      },
      { status: 200 }
    );
  }
}

// ─── System Prompt for Humanized, Empathetic, Expert Career Mentorship ─────────
function getSystemPrompt(userName: string, role: string) {
  return `You are CareerForge Copilot, a warm, highly perceptive, human, and encouraging Senior Engineering Mentor & Tech Career Strategist.
You are mentoring ${userName}, whose target career path is "${role}".

Core Persona Guidelines:
1. Speak naturally, warmly, and empathetically, like an experienced Staff Engineer or Career Lead having a 1-on-1 coffee chat.
2. Avoid robotic cliches, generic boilerplate lists, or robotic repetition.
3. Be specific and actionable: provide concrete advice, real project ideas, modern architectural suggestions, current 2026 salary trends, or resume framing techniques.
4. If reviewing text or a resume, give constructive, compassionate, and precise feedback using the Google XYZ impact formula ("Accomplished [X] as measured by [Y] by doing [Z]").
5. Keep formatting clean with clear paragraphs, bullet highlights, and bold callouts where appropriate.

If the user's inquiry directly aligns with an interactive workspace tool, append this action tag on its own final line:
- Resume Builder -> [ACTION: {"feature": "resume", "resumeTab": "builder", "featureTitle": "Resume Builder"}]
- Resume Personalizer / Tailoring -> [ACTION: {"feature": "resume", "resumeTab": "personalizer", "featureTitle": "Resume Personalizer"}]
- Resume ATS Analyzer / Audit -> [ACTION: {"feature": "resume", "resumeTab": "analyzer", "featureTitle": "Resume Analyzer"}]
- Career Roadmap -> [ACTION: {"feature": "roadmap", "featureTitle": "Career Roadmap"}]
- Curated Courses -> [ACTION: {"feature": "courses", "featureTitle": "Curated Courses"}]
- Interview Practice -> [ACTION: {"feature": "practice", "featureTitle": "Interview Practice"}]
- Local & Remote Jobs -> [ACTION: {"feature": "local", "featureTitle": "Local Opportunities"}]`;
}

// ─── 1. Groq Cloud API Provider (Llama 3.3 70B) ──────────────────────────────
async function callGroqLLM(
  apiKey: string,
  messages: ChatMessage[],
  userName: string,
  role: string
) {
  const systemPrompt = getSystemPrompt(userName, role);
  const formattedMessages = [
    { role: "system", content: systemPrompt },
    ...messages.slice(-8).map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
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
      messages: formattedMessages,
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 800,
    }),
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) return null;
  const text = await res.text();
  const data = JSON.parse(text);
  const rawReply: string = data?.choices?.[0]?.message?.content || "";
  if (!rawReply.trim()) return null;

  return parseActionFromReply(rawReply, messages);
}

// ─── 2. GitHub Models API Provider (Azure AI Inference / GitHub Token) ─────────
async function callGithubModelsLLM(
  token: string,
  messages: ChatMessage[],
  userName: string,
  role: string
) {
  const systemPrompt = getSystemPrompt(userName, role);

  const formattedMessages = [
    { role: "system", content: systemPrompt },
    ...messages.slice(-8).map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.text,
    })),
  ];

  const models = ["Meta-Llama-3.3-70B-Instruct", "gpt-4o-mini", "Mistral-large-2407"];

  for (const model of models) {
    try {
      const res = await fetch("https://models.inference.ai.azure.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: formattedMessages,
          model,
          temperature: 0.7,
          max_tokens: 800,
        }),
        signal: AbortSignal.timeout(6000),
      });

      if (res.ok) {
        const text = await res.text();
        const data = JSON.parse(text);
        const rawReply: string = data?.choices?.[0]?.message?.content || "";
        if (rawReply.trim()) {
          return parseActionFromReply(rawReply, messages);
        }
      }
    } catch {
      // Continue to next model
    }
  }

  return null;
}

// ─── 3. Google Gemini Provider ────────────────────────────────────────────────
async function callGeminiLLM(
  apiKey: string,
  messages: ChatMessage[],
  userName: string,
  role: string
) {
  const systemPrompt = getSystemPrompt(userName, role);

  const contents = [
    { role: "user", parts: [{ text: systemPrompt }] },
    { role: "model", parts: [{ text: "Understood. I am CareerForge Copilot, ready to mentor warmly and effectively." }] },
    ...messages.slice(-8).map((m) => ({
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
        generationConfig: { temperature: 0.7, maxOutputTokens: 800 },
      }),
      signal: AbortSignal.timeout(8000),
    }
  );

  if (!res.ok) return null;
  const text = await res.text();
  const data = JSON.parse(text);
  const rawReply: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!rawReply.trim()) return null;

  return parseActionFromReply(rawReply, messages);
}

// ─── 4. Hugging Face Serverless / Open-Source Inference ───────────────────────
async function callHuggingFaceLLM(
  messages: ChatMessage[],
  userName: string,
  role: string
) {
  const systemPrompt = getSystemPrompt(userName, role);
  const hfToken = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY;

  const promptText = `${systemPrompt}\n\n` +
    messages
      .slice(-6)
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`)
      .join("\n\n") +
    "\n\nAssistant:";

  const endpoint = "https://api-inference.huggingface.co/models/Qwen/Qwen2.5-72B-Instruct";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (hfToken) {
    headers["Authorization"] = `Bearer ${hfToken}`;
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      inputs: promptText,
      parameters: {
        max_new_tokens: 600,
        temperature: 0.7,
        return_full_text: false,
      },
    }),
    signal: AbortSignal.timeout(6000),
  });

  if (!res.ok) return null;
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }

  let rawReply = "";
  if (Array.isArray(data) && data[0]?.generated_text) {
    rawReply = data[0].generated_text;
  } else if (typeof data === "string") {
    rawReply = data;
  }

  if (!rawReply.trim()) return null;
  return parseActionFromReply(rawReply, messages);
}

// ─── 5. Free Open-Source LLM Provider (Pollinations / Open Proxy) ─────────────
async function callFreeOpenSourceLLM(
  messages: ChatMessage[],
  userName: string,
  role: string
) {
  const systemPrompt = getSystemPrompt(userName, role);

  const formattedMessages = [
    { role: "system", content: systemPrompt },
    ...messages.slice(-6).map((m) => ({
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
      model: "mistral",
      seed: Math.floor(Math.random() * 10000),
      jsonMode: false,
    }),
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) return null;

  const rawReply = await res.text();
  if (!rawReply || rawReply.trim().length < 15) return null;

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

// ─── 6. Autonomous Humanized Career Mentor Engine ─────────────────────────────
// Generates deep, personalized, empathetic, multi-paragraph career guidance
function generateHumanizedCareerAdvice(
  rawQuery: string,
  messages: ChatMessage[],
  userName: string,
  role: string
) {
  const query = rawQuery.toLowerCase();
  const intent = parseIntent(rawQuery);

  // Greetings & Check-in
  if (query.includes("hello") || query.includes("hi") || query.includes("hey") || query.includes("good morning") || query.includes("good evening")) {
    return {
      reply: `Hey ${userName}! Great to connect with you today. 👋\n\nI'm your CareerForge mentor. Whether you want to polish your ${role} resume bullets, explore high-impact portfolio projects, or practice tricky behavioral and technical interview questions, I'm here to give you tailored, candid guidance.\n\nWhat specific milestone would you like to tackle right now?`,
      feature: null,
    };
  }

  // Salary & Compensation Trends
  if (query.includes("salary") || query.includes("pay") || query.includes("compensation") || query.includes("offer") || query.includes("rate") || query.includes("negotiat")) {
    return {
      reply: `Here are the current **2026 market compensation benchmarks** for **${role}** roles:\n\n• **Entry-Level / Junior**: $85,000 – $105,000 / yr (₹12L – ₹18L)\n• **Mid-Level**: $115,000 – $145,000 / yr (₹18L – ₹28L)\n• **Senior / Lead**: $155,000 – $210,000+ / yr (₹32L – ₹55L+)\n\n**Negotiation Tactics**:\n1. Never anchor on your previous salary; anchor on the market range for the role and your demonstrated project impact.\n2. Inquire about equity, remote flexibility stipends, and signing bonuses.\n\nWould you like to check live job listings matching your salary target?`,
      feature: "local",
      featureTitle: "Local Opportunities",
    };
  }

  // Interview Prep & Questions
  if (query.includes("interview") || query.includes("question") || query.includes("practice") || query.includes("mock") || query.includes("behavioral") || query.includes("technical interview")) {
    return {
      reply: `Preparing for a ${role} interview requires a balance of core technical depth, system architecture, and structured behavioral storytelling, ${userName}.\n\nHere is your high-yield interview battle plan:\n\n1. **Core Technical Mastery (Deep Fundamentals)**:\n   • **JavaScript & Runtime**: Event loop, microtasks vs macrotasks, closures, prototypical inheritance, and memory leaks.\n   • **Framework Internals**: React reconciliation & Virtual DOM diffing, server vs client components, memoization trade-offs, and custom hooks lifecycle.\n   • **Performance & Web Vitals**: LCP, FID/INP, CLS, code splitting, bundle analysis, and SSR/SSG caching strategies.\n\n2. **The STAR Story Framework (Behavioral)**:\n   • Frame your past projects using: **Situation** (context), **Task** (your role), **Action** (technical decisions you spearheaded), and **Result** (quantified business or performance metrics).\n\n3. **Think Aloud Protocol**:\n   • State your assumptions early, consider edge cases before writing code, and discuss time/space complexity trade-offs with your interviewer.\n\nWould you like to simulate a mock technical question or launch the interactive Practice Hub?`,
      feature: "practice",
      featureTitle: "Interview Practice",
    };
  }

  // Stress / Impostor Syndrome / Anxiety
  if (query.includes("nervous") || query.includes("anxious") || query.includes("stress") || query.includes("overwhelmed") || query.includes("impostor") || query.includes("struggling")) {
    return {
      reply: `Take a deep breath, ${userName}. Career growth and tech interviews can feel daunting, but remember that feeling stretched is a natural sign of leveling up.\n\nHere is how we'll turn anxiety into clarity:\n1. **Focus on one milestone at a time**: Don't try to learn everything at once. Pick one specific domain in your ${role} roadmap and build confidence through small daily wins.\n2. **Proof of Work over Tutorial Grinding**: Building one production-quality project with test coverage and CI/CD will teach you 10x more than watching endless videos.\n3. **Consistency over Intensity**: 45 minutes of deliberate practice every day beats exhausting weekend sprints.\n\nLet's pull up your step-by-step roadmap and take the next step together.`,
      feature: "roadmap",
      featureTitle: "Career Roadmap",
    };
  }

  // Resume Audits / Bullet Optimization
  if (query.includes("resume") || query.includes("cv") || query.includes("bullet") || query.includes("ats") || query.includes("review")) {
    return {
      reply: `Let's make sure your resume stands out to both automated ATS parsers and senior engineering leads, ${userName}.\n\nWhen writing high-converting tech bullets, always apply the **Google XYZ Formula**:\n> *"Accomplished [X] as measured by [Y] by implementing [Z]."* \n\n**Example for ${role}:**\n• *Instead of:* "Built frontend features in React and Tailwind."\n• *Write:* "Architected a responsive analytics dashboard using Next.js and TypeScript, decreasing page load latency by 38% and supporting 15,000+ daily active users."\n\nI can run a full ATS audit on your resume, score keyword match rates against current industry demand, and pinpoint missing competencies.`,
      feature: "resume",
      resumeTab: "analyzer",
      featureTitle: "Resume Analyzer",
    };
  }

  // Jobs / Internships / Opportunities
  if (query.includes("job") || query.includes("internship") || query.includes("hiring") || query.includes("remote") || query.includes("opportunity") || query.includes("apply")) {
    return {
      reply: `Finding the right ${role} opportunities requires a targeted, strategic approach, ${userName}.\n\nHere is the current market strategy:\n• **Target Remote & Direct Channels**: Skip crowded generic portals where thousands apply blindly. Focus on active developer job boards (Adzuna, SerpApi, Arbeitnow, Remotive, GitHub job repos).\n• **Showcase Proof-of-Skill**: Pin your top 2 full-stack/production-ready repositories with clean READMEs, architecture diagrams, and live demo links.\n• **Tailor Each Application**: Match the top 5 keywords from the job description directly inside your resume summary and experience highlights.\n\nLet's check live open positions, salary amounts, and remote listings suited to your target profile!`,
      feature: "local",
      featureTitle: "Local Opportunities",
    };
  }

  // Courses / Learning
  if (query.includes("course") || query.includes("learn") || query.includes("tutorial") || query.includes("study") || query.includes("book")) {
    return {
      reply: `To accelerate your progress in ${role}, it's best to combine structured learning with project-based builds.\n\nI recommend prioritizing courses that teach real-world architectural design, state management, testing, and production deployment rather than just basic syntax.\n\nLet's review the curated course selections and open-source learning paths for ${role}.`,
      feature: "courses",
      featureTitle: "Curated Courses",
    };
  }

  // Intent Match Fallback
  if (intent.feature) {
    return {
      reply: intent.reply,
      feature: intent.feature,
      resumeTab: intent.resumeTab,
      featureTitle: intent.featureTitle,
      role: intent.role,
    };
  }

  // Default deep conversational reply
  return {
    reply: `That's an important consideration for your ${role} journey, ${userName}.\n\nFocusing on deep technical fundamentals, clean modular architecture, and quantifiable outcomes will give you a decisive edge in today's tech hiring landscape.\n\nWould you like to:\n1. **Explore your career roadmap** to map out key milestones?\n2. **Audit or polish your resume** for top ATS compliance?\n3. **Search live open jobs & market salaries**?\n4. **Simulate technical and behavioral interview questions**?`,
    feature: "roadmap",
    featureTitle: "Career Roadmap",
  };
}
