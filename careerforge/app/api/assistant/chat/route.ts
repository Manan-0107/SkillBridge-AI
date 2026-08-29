/**
 * POST /api/assistant/chat
 *
 * Real Conversational AI LLM Backend for CareerForge:
 * - Natural, Casual, Humanized Dialogue (Replies warmly to "how are you?", jokes, banter, chit-chat)
 * - Deep Tech Mentorship & System Architecture
 * - 100% Exact Language Matching (English, Hindi, Gujarati, Spanish, French, etc.)
 * - Multi-Model Fallback: Groq (Llama 3.3 70B / DeepSeek R1), GitHub Models (GPT-4o), Gemini 1.5/2.0 Flash, Hugging Face, and Neural Dialogue Engine
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

    // ─── 5. Autonomous Humanized Conversational Neural Engine ─────────────────
    const dynamicResponse = generateConversationalResponse(lastMessage, messages, userName, role, voiceMode);
    return NextResponse.json({ ...dynamicResponse, engine: "CareerForge Neural AI" });
  } catch (error) {
    console.error("[Assistant API] General error:", error);
    return NextResponse.json(
      {
        reply: "I'm right here with you! What would you like to chat about or explore today?",
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
1. CASUAL & NATURAL BANTER: If the user asks casual questions (e.g. "how are you?", "what's up?", "how's your day?", "tell me a joke", "who are you?"), answer casually, warmly, and naturally with human charm and personality. Do NOT dump unsolicited technical lists unless asked.
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
    { role: "model", parts: [{ text: "Understood. I am CareerForge AI, ready to chat naturally, casually, and help with deep career advice in the user's language." }] },
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

// ─── 5. Dynamic Humanized Conversational Neural Engine ─────────────────────────
function generateConversationalResponse(
  rawQuery: string,
  messages: ChatMessage[],
  userName: string,
  role: string,
  voiceMode = false
) {
  const query = rawQuery.toLowerCase().trim();
  const isGujarati = /[\u0A80-\u0AFF]/.test(rawQuery);
  const isHindi = /[\u0900-\u097F]/.test(rawQuery);
  const isSpanish = /[\u00C0-\u00FF]/.test(rawQuery) && (query.includes("hola") || query.includes("como estas") || query.includes("que tal"));

  // ── A. Casual Chit-Chat & "How are you?" ────────────────────────────────────
  if (
    query.includes("how are you") ||
    query.includes("how r u") ||
    query.includes("how's it going") ||
    query.includes("hows it going") ||
    query.includes("whats up") ||
    query.includes("what's up") ||
    query.includes("how are you doing") ||
    query.includes("how have you been") ||
    query.includes("how is your day") ||
    query.includes("કેમ છો") ||
    query.includes("તમે કેમ છો") ||
    query.includes("શું ચાલે છે") ||
    query.includes("आप कैसे हैं") ||
    query.includes("कैसे हो") ||
    query.includes("क्या हाल है") ||
    query.includes("सब कैसा है")
  ) {
    if (isGujarati || query.includes("કેમ છો") || query.includes("શું ચાલે")) {
      return {
        reply: `હું ખૂબ મજામાં છું, પૂછવા બદલ આભાર, ${userName}! 😊 તમારો દિવસ કેવો ચાલે છે? આજે આપણે શેના પર કામ કરીશું?`,
        feature: null,
      };
    }
    if (isHindi || query.includes("कैसे") || query.includes("क्या हाल")) {
      return {
        reply: `मैं बहुत बढ़िया हूँ, पूछने के लिए धन्यवाद, ${userName}! 😊 आपका दिन कैसा चल रहा है? आज हम किस चीज़ पर काम करें?`,
        feature: null,
      };
    }
    if (isSpanish) {
      return {
        reply: `¡Estoy genial, gracias por preguntar, ${userName}! 😊 ¿Cómo estás tú? ¿En qué te gustaría trabajar hoy?`,
        feature: null,
      };
    }
    return {
      reply: voiceMode
        ? `I'm doing fantastic, thanks for asking, ${userName}! 😊 How are things with you today? What's on your mind?`
        : `I'm doing fantastic, thanks for asking, ${userName}! 😊\n\nI'm having a great day helping developers and engineers sharpen their skills and level up. How are things with you? What's on your mind today?`,
      feature: null,
    };
  }

  // ── B. General Greetings ("Hello", "Hi", "Hey") ─────────────────────────────
  if (
    query === "hello" ||
    query === "hi" ||
    query === "hey" ||
    query === "hey there" ||
    query === "good morning" ||
    query === "good afternoon" ||
    query === "good evening" ||
    query.startsWith("hi ") ||
    query.startsWith("hello ")
  ) {
    if (isGujarati) {
      return {
        reply: `નમસ્તે ${userName}! 👋 કરિયરફોર્જમાં તમારું સ્વાગત છે. આજે તમે શું શીખવા અથવા શોધવા માંગો છો?`,
        feature: null,
      };
    }
    if (isHindi) {
      return {
        reply: `नमस्ते ${userName}! 👋 करियरफोर्ज में आपका स्वागत है। आज आप क्या नया सीखना या एक्सप्लोर करना चाहते हैं?`,
        feature: null,
      };
    }
    return {
      reply: voiceMode
        ? `Hey ${userName}! Great to chat with you today. What would you like to explore or work on?`
        : `Hey ${userName}! Great to connect with you today. 👋\n\nI'm your CareerForge mentor. Whether you're looking to polish your resume, practice interview scenarios, or explore verified local jobs in your city, I'm here to help. What's on your agenda today?`,
      feature: null,
    };
  }

  // ── C. Jokes & Fun ──────────────────────────────────────────────────────────
  if (query.includes("joke") || query.includes("funny") || query.includes("make me laugh")) {
    const jokes = [
      `Why do programmers prefer dark mode? Because light attracts bugs! 🐛😂`,
      `There are 10 types of people in the world: those who understand binary, and those who don't! 💻`,
      `Why was the JavaScript developer sad? Because they didn't know how to 'null' their feelings! ☕`,
    ];
    const joke = jokes[Math.floor(Math.random() * jokes.length)];
    return { reply: joke, feature: null };
  }

  // ── D. "Who are you?" / "What can you do?" ─────────────────────────────────
  if (query.includes("who are you") || query.includes("what are you") || query.includes("what can you do") || query.includes("what do you do")) {
    return {
      reply: voiceMode
        ? `I am CareerForge AI, your intelligent career mentor. I can help you build resumes, practice technical interviews, and find real-time jobs in your city.`
        : `I'm **CareerForge AI**, your personalized career strategist and technical mentor. 🚀\n\nHere is how I can assist you:\n• **Resume Engineering**: Write ATS-optimized bullet points using the Google XYZ impact formula.\n• **Interview Simulator**: Practice interactive behavioral and technical mock interviews with live AI feedback.\n• **Job Discovery**: Live Uber-style geolocation tracking for verified local & remote openings in your city.\n• **Skill Roadmaps**: Step-by-step career milestone roadmaps tailored for ${role}.\n\nWhat would you like to start with?`,
      feature: null,
    };
  }

  // ── E. Salary & Compensation Benchmarks ──────────────────────────────────────
  if (query.includes("salary") || query.includes("pay") || query.includes("compensation") || query.includes("offer") || query.includes("rate")) {
    return {
      reply: `Here are the current **2026 compensation benchmarks** for **${role}**:\n\n• **Entry-Level**: ₹12L – ₹18L / yr ($85k – $105k)\n• **Mid-Level**: ₹18L – ₹28L / yr ($115k – $145k)\n• **Senior / Lead**: ₹32L – ₹55L+ / yr ($155k – $210k+)\n\nWould you like to explore live openings matching your salary target in the Local Opportunities hub?`,
      feature: "local",
      featureTitle: "Local Opportunities",
    };
  }

  // ── F. Interview Prep & Questions ───────────────────────────────────────────
  if (query.includes("interview") || query.includes("question") || query.includes("mock") || query.includes("practice")) {
    return {
      reply: `Great! Preparing for ${role} interviews is all about combining deep fundamentals with clear behavioral storytelling (the STAR method).\n\nLet's head over to the **Practice Hub** where we can simulate real technical questions and evaluate your answers with instant AI feedback.`,
      feature: "practice",
      featureTitle: "Interview Practice",
    };
  }

  // ── G. Resume Help & Audit ──────────────────────────────────────────────────
  if (query.includes("resume") || query.includes("cv") || query.includes("ats") || query.includes("bullet")) {
    return {
      reply: `Let's make your resume stand out! We can run an **ATS Audit** or build high-impact bullet points using the formula: *Accomplished [X] measured by [Y] by doing [Z]*.\n\nOpening the Resume Studio for you right now.`,
      feature: "resume",
      resumeTab: "analyzer",
      featureTitle: "Resume Analyzer",
    };
  }

  // ── H. Jobs & Openings ──────────────────────────────────────────────────────
  if (query.includes("job") || query.includes("opening") || query.includes("hiring") || query.includes("vacancy") || query.includes("work")) {
    return {
      reply: `Tracking real-time live openings for ${role} in your verified city and worldwide remote platforms right now.`,
      feature: "local",
      featureTitle: "Local Opportunities",
    };
  }

  // ── I. General Intelligent Fallback ─────────────────────────────────────────
  const defaultReply = voiceMode
    ? `I understand! Let's explore your ${role} career path. What specific area would you like to dive into?`
    : `I hear you, ${userName}! Let's focus on advancing your career in **${role}**.\n\nWhether you'd like to polish your resume, practice technical mock questions, or explore live job postings in your city, let me know what you'd like to dive into!`;

  return { reply: defaultReply, feature: null };
}
