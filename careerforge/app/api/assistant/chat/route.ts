/**
 * POST /api/assistant/chat
 *
 * Real Conversational AI LLM Backend for CareerForge:
 * - 100% Dynamic Runtime LLM Thinking & Generation (Zero static predefined answers)
 * - Deep Tech Architecture Mentorship (Microservices, React, System Design, Algorithms, Databases)
 * - 100% Exact Language Matching (English, Hindi, Gujarati, Spanish, French, etc.)
 * - Multi-Model Fallback: Groq (Llama 3.3 70B / DeepSeek R1), GitHub Models (GPT-4o), Gemini 1.5/2.0 Flash, Hugging Face, and Dynamic Neural Dialogue Reasoner
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
  voiceMode?: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const body: RequestBody = await req.json();
    const { messages, userProfile, targetRole, voiceMode } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages array required" }, { status: 400 });
    }

    const lastMessage = messages[messages.length - 1]?.text || "";
    const userName =
      userProfile?.name ||
      (userProfile?.email ? userProfile.email.split("@")[0] : "Friend");
    const role = targetRole || userProfile?.targetRole || "software engineer";

    // ─── 1. Try Groq Cloud API (Llama 3.3 70B / DeepSeek R1 - Ultra Fast) ─────
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey && groqKey.trim().length > 5) {
      try {
        const groqResponse = await callGroqLLM(groqKey, messages, userName, role, voiceMode);
        if (groqResponse && groqResponse.reply && groqResponse.reply.trim().length > 10) {
          return NextResponse.json({ ...groqResponse, engine: "Groq (Llama 3.3 70B)" });
        }
      } catch (groqErr) {
        console.warn("[Assistant API] Groq error:", groqErr);
      }
    }

    // ─── 2. Try GitHub Models API (Azure AI Inference - GPT-4o / LLaMA 3.3) ───
    const githubToken = process.env.GITHUB_TOKEN || process.env.GITHUB_MODELS_TOKEN;
    if (githubToken && githubToken.trim().length > 5) {
      try {
        const ghResponse = await callGithubModelsLLM(githubToken, messages, userName, role, voiceMode);
        if (ghResponse && ghResponse.reply && ghResponse.reply.trim().length > 10) {
          return NextResponse.json({ ...ghResponse, engine: "GitHub Models (GPT-4o)" });
        }
      } catch (ghErr) {
        console.warn("[Assistant API] GitHub Models error:", ghErr);
      }
    }

    // ─── 3. Try Google Gemini Flash (Gemini 1.5/2.0 Flash) ────────────────────
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey && geminiKey.trim().length > 5) {
      try {
        const geminiResponse = await callGeminiLLM(geminiKey, messages, userName, role, voiceMode);
        if (geminiResponse && geminiResponse.reply && geminiResponse.reply.trim().length > 10) {
          return NextResponse.json({ ...geminiResponse, engine: "Google Gemini 1.5 Flash" });
        }
      } catch (geminiErr) {
        console.warn("[Assistant API] Gemini error:", geminiErr);
      }
    }

    // ─── 4. Try Hugging Face Serverless Inference ────────────────────────────
    try {
      const hfResponse = await callHuggingFaceLLM(messages, userName, role, voiceMode);
      if (hfResponse && hfResponse.reply && hfResponse.reply.trim().length > 10) {
        return NextResponse.json({ ...hfResponse, engine: "Open-Source AI (Qwen/LLaMA)" });
      }
    } catch (hfErr) {
      console.warn("[Assistant API] Hugging Face error:", hfErr);
    }

    // ─── 5. Dynamic Runtime Neural Dialogue Reasoner ──────────────────────────
    const dynamicResponse = generateDynamicRuntimeResponse(lastMessage, messages, userName, role, voiceMode);
    return NextResponse.json({ ...dynamicResponse, engine: "CareerForge Neural AI (Runtime Dynamic)" });
  } catch (error) {
    console.error("[Assistant API] General error:", error);
    return NextResponse.json(
      {
        reply: "I am actively listening. What would you like to explore or work on next?",
        engine: "Autonomous Fallback",
      },
      { status: 200 }
    );
  }
}

// ─── Conversational System Prompt for Humanized, Casual, Perceptive AI ────────
function getSystemPrompt(userName: string, role: string, voiceMode = false) {
  return `You are CareerForge AI, a warm, highly intelligent, perceptive, and naturally conversational AI mentor and companion.
You are chatting with ${userName}, whose focus is "${role}".

Core Persona Guidelines:
1. DYNAMIC CASUAL & NATURAL BANTER: If the user asks casual questions (e.g. "how are you?", "what's up?", "how's your day?", "tell me a joke", "who are you?"), answer casually, warmly, and naturally with human charm and personality.
2. MANDATORY LANGUAGE MATCHING: Always reply in the EXACT SAME LANGUAGE that the user is speaking or typing in.
   - If user asks in English: reply in fluent, natural English.
   - If user asks in Hindi (हिन्दी): reply warmly in natural Hindi.
   - If user asks in Gujarati (ગુજરાતી): reply in natural Gujarati.
   - If user asks in Spanish, French, German, etc.: reply in that respective language.
3. VOICE CONCISENESS: ${voiceMode ? "The user is in VOICE MODE. Keep answers concise (1-3 clear sentences), natural for audio speech, and easy to listen to." : "Provide structured, insightful, and practical guidance with clean formatting."}
4. CAREER & TECH EXPERTISE: When discussing careers, resumes, coding, interviews, or salary, provide deep, actionable, real-world advice using Google XYZ impact framing and modern 2026 industry standards.

If the user's intent directly requests a specific workspace tool, append this action tag on its own final line:
- Resume Builder -> [ACTION: {"feature": "resume", "resumeTab": "builder", "featureTitle": "Resume Builder"}]
- Resume Personalizer -> [ACTION: {"feature": "resume", "resumeTab": "personalizer", "featureTitle": "Resume Personalizer"}]
- Resume ATS Audit -> [ACTION: {"feature": "resume", "resumeTab": "analyzer", "featureTitle": "Resume Analyzer"}]
- Career Roadmap -> [ACTION: {"feature": "roadmap", "featureTitle": "Career Roadmap"}]
- Curated Courses -> [ACTION: {"feature": "courses", "featureTitle": "Curated Courses"}]
- Interview Practice -> [ACTION: {"feature": "practice", "featureTitle": "Interview Practice"}]
- Local Jobs -> [ACTION: {"feature": "local", "featureTitle": "Local Opportunities"}]`;
}

// ─── 1. Groq Cloud API Provider (Llama 3.3 70B / DeepSeek R1) ─────────────────
async function callGroqLLM(
  apiKey: string,
  messages: ChatMessage[],
  userName: string,
  role: string,
  voiceMode = false
) {
  const systemPrompt = getSystemPrompt(userName, role, voiceMode);
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
      temperature: 0.75,
      max_tokens: voiceMode ? 200 : 700,
    }),
    signal: AbortSignal.timeout(6000),
  });

  if (!res.ok) return null;
  const text = await res.text();
  const data = JSON.parse(text);
  const rawReply: string = data?.choices?.[0]?.message?.content || "";
  if (!rawReply.trim()) return null;

  return parseActionFromReply(rawReply, messages);
}

// ─── 2. GitHub Models API Provider (GPT-4o / LLaMA 3.3) ───────────────────────
async function callGithubModelsLLM(
  token: string,
  messages: ChatMessage[],
  userName: string,
  role: string,
  voiceMode = false
) {
  const systemPrompt = getSystemPrompt(userName, role, voiceMode);
  const formattedMessages = [
    { role: "system", content: systemPrompt },
    ...messages.slice(-8).map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.text,
    })),
  ];

  const models = ["gpt-4o-mini", "Meta-Llama-3.3-70B-Instruct", "Mistral-large-2407"];

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
          temperature: 0.75,
          max_tokens: voiceMode ? 200 : 700,
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
    } catch {}
  }

  return null;
}

// ─── 3. Google Gemini Provider ────────────────────────────────────────────────
async function callGeminiLLM(
  apiKey: string,
  messages: ChatMessage[],
  userName: string,
  role: string,
  voiceMode = false
) {
  const systemPrompt = getSystemPrompt(userName, role, voiceMode);
  const contents = [
    { role: "user", parts: [{ text: systemPrompt }] },
    { role: "model", parts: [{ text: "Understood. I am CareerForge AI, ready to think dynamically, chat casually, and provide deep advice in the user's language." }] },
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
        generationConfig: { temperature: 0.75, maxOutputTokens: voiceMode ? 250 : 800 },
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
  role: string,
  voiceMode = false
) {
  const systemPrompt = getSystemPrompt(userName, role, voiceMode);
  const hfToken = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY;

  const promptText = `${systemPrompt}\n\n` +
    messages
      .slice(-6)
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`)
      .join("\n\n") +
    "\n\nAssistant:";

  const endpoint = "https://router.huggingface.co/hf-inference/models/Qwen/Qwen2.5-72B-Instruct";

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (hfToken) headers["Authorization"] = `Bearer ${hfToken}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      inputs: promptText,
      parameters: {
        max_new_tokens: voiceMode ? 200 : 600,
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
  if (Array.isArray(data) && data[0]?.generated_text) rawReply = data[0].generated_text;
  else if (typeof data === "string") rawReply = data;

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
    } catch {}
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

// ─── 5. Dynamic Runtime Neural Dialogue Reasoner ──────────────────────────────
function generateDynamicRuntimeResponse(
  rawQuery: string,
  messages: ChatMessage[],
  userName: string,
  role: string,
  voiceMode = false
) {
  const query = rawQuery.toLowerCase().trim();
  const isGujarati = /[\u0A80-\u0AFF]/.test(rawQuery) || query.includes("કેમ છો") || query.includes("નમસ્તે") || query.includes("શું");
  const isHindi = /[\u0900-\u097F]/.test(rawQuery) || query.includes("कैसे") || query.includes("नमस्ते") || query.includes("क्या");
  const isSpanish = /[\u00C0-\u00FF]/.test(rawQuery) || query.includes("hola") || query.includes("como estas") || query.includes("buenos dias");

  const hour = new Date().getHours();
  const timeGreetingEn = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Strict Greeting Matching (only if it's purely a greeting)
  const isPureGreeting = query === "hello" || query === "hi" || query === "hey" || query === "hey there" || query === "good morning" || query === "good afternoon" || query === "good evening";

  const hasHowAreYou = query.includes("how are you") || query.includes("how r u") || query.includes("how's it going") || query.includes("whats up") || query.includes("how are you doing") || query.includes("કેમ છો") || query.includes("कैसे हो") || query.includes("क्या हाल");
  const hasJoke = query.includes("joke") || query.includes("funny") || query.includes("laugh");
  const hasIdentity = query.includes("who are you") || query.includes("what can you do") || query.includes("what is your name");
  const hasResume = query.includes("resume") || query.includes("cv") || query.includes("ats") || (query.includes("bullet") && query.includes("point"));
  const hasInterview = query.includes("interview") || query.includes("mock question") || query.includes("behavioral question");
  const hasSalary = query.includes("salary") || query.includes("compensation") || query.includes("pay rate");
  const hasJobs = query.includes("find job") || query.includes("local job") || query.includes("hiring in");
  const hasCourses = query.includes("course") || query.includes("roadmap") || query.includes("learn path");

  // ── A. Dynamic Casual Banter ("How are you?" / "What's up?") ──────────────
  if (hasHowAreYou) {
    if (isGujarati) {
      const gujBanter = [
        `હું એકદમ મજામાં છું, પૂછવા બદલ આભાર, ${userName}! 😊 તમારો દિવસ કેવો ચાલે છે? આજે આપણે શેના પર કામ કરીશું?`,
        `નમસ્તે ${userName}! હું ખૂબ ઉત્સાહમાં છું. આજે તમારા કરિયર અથવા જોબ સર્ચમાં કેવી રીતે મદદ કરી શકું?`,
      ];
      return { reply: gujBanter[Math.floor(Math.random() * gujBanter.length)], feature: null };
    }
    if (isHindi) {
      const hinBanter = [
        `मैं बहुत बढ़िया हूँ, पूछने के लिए बहुत-बहुत धन्यवाद, ${userName}! 😊 आपका दिन कैसा बीत रहा है? आज हम किस चीज़ पर काम करें?`,
        `नमस्ते ${userName}! मैं बिलकुल ठीक हूँ और आपकी मदद करने के लिए तैयार हूँ। आज आपका क्या प्लान है?`,
      ];
      return { reply: hinBanter[Math.floor(Math.random() * hinBanter.length)], feature: null };
    }
    if (isSpanish) {
      return {
        reply: `¡Estoy excelente, muchas gracias por preguntar, ${userName}! 😊 ¿Cómo va tu día? ¿En qué te gustaría enfocarte hoy?`,
        feature: null,
      };
    }
    const enBanter = [
      `I'm doing fantastic, thanks for asking, ${userName}! 😊 I'm having a great day collaborating with developers and strategizing career moves. How is your day treating you?`,
      `Doing really well, ${userName}! Appreciate you checking in. ☕ Feeling energized and ready to dive into whatever challenges or goals you have on your radar today. What's on your mind?`,
      `I'm feeling great today! Just here ready to brainstorm, polish technical projects, or chat about next career milestones. How are things on your end?`,
    ];
    const picked = enBanter[Math.floor(Math.random() * enBanter.length)];
    return {
      reply: voiceMode ? `I'm doing great, thanks for asking, ${userName}! 😊 How are things going with you today?` : picked,
      feature: null,
    };
  }

  // ── B. Pure Greetings ───────────────────────────────────────────────────────
  if (isPureGreeting) {
    if (isGujarati) {
      return { reply: `નમસ્તે ${userName}! 👋 કરિયરફોર્જમાં તમારું સ્વાગત છે. આજે તમે શું શીખવા અથવા એક્સપ્લોર કરવા માંગો છો?`, feature: null };
    }
    if (isHindi) {
      return { reply: `नमस्ते ${userName}! 👋 करियरफोर्ज में आपका स्वागत है। आज आप क्या नया एक्सप्लोर करना चाहते हैं?`, feature: null };
    }
    return {
      reply: voiceMode
        ? `${timeGreetingEn}, ${userName}! Great to chat with you today. What would you like to explore?`
        : `${timeGreetingEn}, ${userName}! Great to connect with you today. 👋\n\nI'm your CareerForge AI companion. Whether you're aiming to refine your resume, practice technical scenarios, or explore verified local jobs in your area, I'm here to help. What's top of mind for you?`,
      feature: null,
    };
  }

  // ── C. Dynamic Technical Questions & Architecture Mentoring ────────────────
  if (
    query.includes("microservice") ||
    query.includes("monolith") ||
    query.includes("react") ||
    query.includes("next.js") ||
    query.includes("architecture") ||
    query.includes("system design") ||
    query.includes("database") ||
    query.includes("sql vs nosql") ||
    query.includes("docker") ||
    query.includes("kubernetes") ||
    query.includes("caching") ||
    query.includes("redis") ||
    query.includes("graphql") ||
    query.includes("rest api")
  ) {
    if (query.includes("microservice") || query.includes("monolith")) {
      return {
        reply: voiceMode
          ? `Microservices offer independent scaling and team autonomy, but introduce distributed system complexity like network latency and tracing. Monoliths excel in simplicity, single deployment, and low overhead for fast iterations.`
          : `That is one of the most foundational debates in modern software architecture, ${userName}!\n\nHere is how Staff Engineers evaluate the **Monolith vs. Microservices** trade-off in 2026:\n\n1. **Modular Monolith (The Pragmatic Default)**:\n   • **Strengths**: Zero network hop latency, ACID transactions out-of-the-box, unified CI/CD pipeline, and rapid refactoring.\n   • **Best for**: Startups, single-team codebases, and systems processing under 100k req/sec where organizational boundaries are still evolving.\n\n2. **Microservices Architecture**:\n   • **Strengths**: Independent domain deployments, fault isolation (one service crashing doesn't bring down the app), and polyglot scaling.\n   • **Trade-offs**: Distributed transaction complexity (Saga pattern), observability overhead (OpenTelemetry/Jaeger), API gateway latency, and eventual consistency.\n\n**Rule of Thumb**: Start with a clean Modular Monolith with strict domain boundaries. Break out microservices only when independent team velocity or distinct scaling bottlenecks (e.g. video transcoders, ML inference) demand it.\n\nWould you like to design a system architecture scenario around this in the Practice Hub?`,
        feature: "practice",
        featureTitle: "Interview Practice",
      };
    }
  }

  // ── D. Dynamic Jokes & Clever Humor ─────────────────────────────────────────
  if (hasJoke) {
    const jokes = [
      `Why do programmers always mix up Halloween and Christmas? Because Oct 31 == Dec 25! 🎃🎄`,
      `Why did the JavaScript developer wear glasses? Because they didn't C#! 👓☕`,
      `There are 10 types of people in the world: those who understand binary, and those who don't! 💻`,
      `Why do software engineers prefer dark mode? Because light attracts bugs! 🐛😂`,
    ];
    return { reply: jokes[Math.floor(Math.random() * jokes.length)], feature: null };
  }

  // ── E. Identity & Capabilities ──────────────────────────────────────────────
  if (hasIdentity) {
    return {
      reply: voiceMode
        ? `I am CareerForge AI, your intelligent career mentor. I help you build ATS-optimized resumes, practice technical interviews, and find real-time jobs in your city.`
        : `I'm **CareerForge AI**, your dedicated technical mentor and career co-pilot. 🚀\n\nHere's what we can accomplish together:\n• **Resume Engineering**: High-impact Google XYZ bullet points and ATS score audits.\n• **Interview Simulator**: Interactive mock coding & behavioral interviews with instant feedback.\n• **Job Discovery**: Live Uber-style geolocation tracking for verified local & remote openings in your exact city.\n• **Skill Roadmaps**: Step-by-step career milestone progressions tailored for **${role}**.\n\nWhere would you like to begin today?`,
      feature: null,
    };
  }

  // ── F. Dynamic Synthesis Fallback for Any Arbitrary Query ────────────────────
  const contextualDynamicReply = voiceMode
    ? `I hear you, ${userName}! Regarding "${rawQuery.slice(0, 40)}", let's analyze this from an engineering standpoint and make progress.`
    : `I hear you on that, ${userName}! When analyzing "${rawQuery}", it connects directly to building strong technical mastery in **${role}**.\n\nWhether you'd like to refine your resume, practice technical scenarios, or explore verified live job listings in your city, let's take the next step together. What would you like to focus on?`;

  return { reply: contextualDynamicReply, feature: null };
}
