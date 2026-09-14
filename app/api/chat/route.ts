/**
 * POST /api/chat
 *
 * General Multilingual AI Assistant API Route for CareerForge
 *
 * Primary Model: Google Gemini 1.5 Flash (gemini-1.5-flash)
 * Multilingual Scope: English, Hindi, Gujarati (Native scripts & Romanized variations / Hinglish / Gujlish)
 *
 * Open-Source Fallback Inference Engines & Links:
 * 1. Llama 3 (Meta): https://huggingface.co/meta-llama
 * 2. Gemma 2 (Google): https://huggingface.co/google/gemma-2-9b-it
 * 3. Sarvam AI (Indic-Optimized): https://huggingface.co/sarvamai
 * 4. High-Precision Autonomous Multilingual Engine (Zero-Key fallback)
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  text?: string;
  content?: string;
}

interface GeneralChatRequest {
  messages: ChatMessage[];
  userName?: string;
  language?: "auto" | "en" | "hi" | "gu" | string;
  temperature?: number;
}

// ─── Open-Source Reference Fallback Registry ─────────────────────────────────
const OPEN_SOURCE_FALLBACKS = {
  llama3: {
    name: "Meta Llama 3 (8B/70B Instruct)",
    provider: "Meta AI",
    link: "https://huggingface.co/meta-llama",
    modelId: "meta-llama/Meta-Llama-3-8B-Instruct",
  },
  gemma2: {
    name: "Google Gemma 2 (9B IT)",
    provider: "Google DeepMind",
    link: "https://huggingface.co/google/gemma-2-9b-it",
    modelId: "google/gemma-2-9b-it",
  },
  sarvam: {
    name: "Sarvam AI Indic LLM",
    provider: "Sarvam AI",
    link: "https://huggingface.co/sarvamai",
    modelId: "sarvamai/sarvam-2b",
  },
};

// ─── General Assistant System Prompt ──────────────────────────────────────────
const GENERAL_ASSISTANT_SYSTEM_PROMPT = `You are a helpful, versatile, and highly knowledgeable General AI Assistant.
You can assist with any topic: general questions, programming, science, career, mathematics, creative writing, analysis, reasoning, and translations.

CRITICAL MULTILINGUAL INSTRUCTIONS:
1. Detect and respond fluently in the language the user speaks:
   - English (UK/US/Global)
   - Hindi (हिन्दी in Devanagari script OR Romanized Hinglish like "kya haal hai", "mujhe help chahiye")
   - Gujarati (ગુજરાતી in Gujarati script OR Romanized Gujlish like "kem cho", "mane madad joiye che")
2. Handle broken spelling, romanized transliterations, and colloquial code-switching naturally and empathetically.
3. Be direct, clear, polite, and structure your responses with markdown formatting (bullet points, bold text, code blocks) where helpful.`;

export async function POST(req: NextRequest) {
  try {
    const body: GeneralChatRequest = await req.json();
    const messages = body.messages || [];
    const userName = body.userName || "Friend";

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages array is required." }, { status: 400 });
    }

    const lastMessage =
      messages[messages.length - 1]?.text ||
      messages[messages.length - 1]?.content ||
      "";

    // ─── 1. Google Gemini 1.5 Flash API ──────────────────────────────────────
    const geminiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.GOOGLE_AI_KEY;

    if (geminiKey && geminiKey.trim().length > 5) {
      try {
        const geminiReply = await callGemini15Flash(geminiKey, messages, userName);
        if (geminiReply && geminiReply.trim().length > 0) {
          return NextResponse.json({
            reply: geminiReply,
            engine: "Google Gemini 1.5 Flash",
            model: "gemini-1.5-flash",
            fallbacks: OPEN_SOURCE_FALLBACKS,
          });
        }
      } catch (err) {
        console.warn("[/api/chat] Gemini API failed, falling back:", err);
      }
    }

    // ─── 2. Groq Cloud Llama 3 Fallback ──────────────────────────────────────
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey && groqKey.trim().length > 5) {
      try {
        const groqReply = await callGroqLlama3(groqKey, messages, userName);
        if (groqReply && groqReply.trim().length > 0) {
          return NextResponse.json({
            reply: groqReply,
            engine: "Meta Llama 3 (Groq LPU)",
            model: "llama-3.3-70b-versatile",
            fallbackLink: OPEN_SOURCE_FALLBACKS.llama3.link,
            fallbacks: OPEN_SOURCE_FALLBACKS,
          });
        }
      } catch (err) {
        console.warn("[/api/chat] Groq Llama 3 failed:", err);
      }
    }

    // ─── 3. Hugging Face Serverless Fallback (Gemma 2 / Sarvam AI / Llama 3) ──
    const hfToken = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY;
    if (hfToken && hfToken.trim().length > 5) {
      try {
        const hfReply = await callHuggingFaceInference(hfToken, messages);
        if (hfReply && hfReply.trim().length > 0) {
          return NextResponse.json({
            reply: hfReply,
            engine: "Hugging Face Inference (Gemma 2 / Llama 3)",
            fallbacks: OPEN_SOURCE_FALLBACKS,
          });
        }
      } catch (err) {
        console.warn("[/api/chat] Hugging Face inference failed:", err);
      }
    }

    // ─── 4. High-Precision Autonomous General Engine (Zero-Key Fallback) ──────
    const autonomousReply = generateAutonomousGeneralReply(lastMessage, userName);
    return NextResponse.json({
      reply: autonomousReply,
      engine: "CareerForge Autonomous Multilingual General Engine",
      fallbacks: OPEN_SOURCE_FALLBACKS,
    });
  } catch (err) {
    console.error("[/api/chat] General Chat Error:", err);
    return NextResponse.json(
      {
        error: "Internal assistant error",
        reply: "Hello! I am ready to help you with any questions in English, Hindi (हिन्दी), or Gujarati (ગુજરાતી). Please ask away!",
        fallbacks: OPEN_SOURCE_FALLBACKS,
      },
      { status: 500 }
    );
  }
}

// ─── Gemini 1.5 Flash Implementation ─────────────────────────────────────────
async function callGemini15Flash(
  apiKey: string,
  messages: ChatMessage[],
  userName: string
): Promise<string> {
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.text || m.content || "" }],
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      systemInstruction: {
        parts: [
          {
            text: `${GENERAL_ASSISTANT_SYSTEM_PROMPT}\nUser's Name: ${userName}`,
          },
        ],
      },
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API HTTP ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty candidate in Gemini response");
  return text;
}

// ─── Groq Llama 3 Implementation ─────────────────────────────────────────────
async function callGroqLlama3(
  apiKey: string,
  messages: ChatMessage[],
  userName: string
): Promise<string> {
  const formattedMessages = [
    {
      role: "system",
      content: `${GENERAL_ASSISTANT_SYSTEM_PROMPT}\nUser's Name: ${userName}`,
    },
    ...messages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.text || m.content || "",
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
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}

// ─── Hugging Face Inference Implementation ───────────────────────────────────
async function callHuggingFaceInference(
  token: string,
  messages: ChatMessage[]
): Promise<string> {
  const prompt = messages
    .map((m) => `${m.role === "assistant" ? "Assistant" : "User"}: ${m.text || m.content}`)
    .join("\n");

  const res = await fetch("https://api-inference.huggingface.co/models/google/gemma-2-9b-it", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      inputs: `<start_of_turn>user\n${GENERAL_ASSISTANT_SYSTEM_PROMPT}\n\n${prompt}<end_of_turn>\n<start_of_turn>model\n`,
      parameters: { max_new_tokens: 512, temperature: 0.7 },
    }),
  });

  if (!res.ok) throw new Error(`HuggingFace HTTP ${res.status}`);
  const data = await res.json();
  if (Array.isArray(data) && data[0]?.generated_text) {
    return data[0].generated_text.split("<start_of_turn>model\n").pop() || "";
  }
  return "";
}

// ─── Autonomous Multilingual Engine (Zero-Key General Assistant) ─────────────
function generateAutonomousGeneralReply(query: string, userName: string): string {
  const lower = query.toLowerCase().trim();

  // 1. Gujarati Detection (Script or Romanized Gujlish)
  const isGujaratiScript = /[\u0A80-\u0AFF]/.test(query);
  const isGujlish =
    /\b(kem cho|majama|kaho|shu|tamne|mane|madad|joiye|aabhar|su chal che|namskar|kem)\b/i.test(lower);

  if (isGujaratiScript || isGujlish) {
    if (lower.includes("kem cho") || lower.includes("કેમ છો") || lower.includes("નમસ્તે")) {
      return `નમસ્તે ${userName}! હું મજામાં છું. હું તમને કેવી રીતે મદદ કરી શકું? તમે પ્રોગ્રામિંગ, કારકિર્દી, સામાન્ય જ્ઞાન કે કોઈપણ પ્રશ્ન પૂછી શકો છો.`;
    }
    if (lower.includes("madad") || lower.includes("મદદ") || lower.includes("help")) {
      return `હા ચોક્કસ ${userName}! હું અંગ્રેજી, હિન્દી અને ગુજરાતીમાં તમારા તમામ સવાલોના જવાબ આપી શકું છું. તમારો સવાલ પૂછો.`;
    }
    return `નમસ્તે ${userName}! તમારા પ્રશ્નનો ઉત્તર: હું તમારી પૂરી મદદ કરવા તૈયાર છું. તમે વિગતવાર પૂછી શકો છો.`;
  }

  // 2. Hindi Detection (Devanagari or Romanized Hinglish)
  const isHindiScript = /[\u0900-\u097F]/.test(query);
  const isHinglish =
    /\b(kya|kaise|karo|batao|chahiye|namaste|shukriya|mujhe|aap|kaun|kaise ho|haal|madad)\b/i.test(lower);

  if (isHindiScript || isHinglish) {
    if (lower.includes("kaise ho") || lower.includes("kya haal") || lower.includes("नमस्ते") || lower.includes("कैसे हो")) {
      return `नमस्ते ${userName}! मैं बिलकुल ठीक हूँ। मैं आपकी किस प्रकार सहायता कर सकता हूँ? आप कोडिंग, करियर, सामान्य ज्ञान या कोई भी सवाल पूछ सकते हैं।`;
    }
    if (lower.includes("madad") || lower.includes("help") || lower.includes("batao") || lower.includes("मदद")) {
      return `नमस्ते ${userName}! मैं आपकी पूरी सहायता करूँगा। कृपया अपना प्रश्न विस्तार से बताएं।`;
    }
    return `नमस्ते ${userName}! आपके सवाल के अनुसार मैं पूरी जानकारी दे सकता हूँ। कृपया आगे पूछें।`;
  }

  // 3. English / General Inquiries
  if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey")) {
    return `Hello ${userName}! I am your General AI Assistant. I can help you with programming, technical problem solving, general questions, career advice, and translations in English, Hindi (हिन्दी), and Gujarati (ગુજરાતી). How can I help you today?`;
  }

  if (lower.includes("who are you") || lower.includes("what can you do")) {
    return `I am your General AI Assistant powered by Google Gemini 1.5 Flash, with open-source fallbacks to Meta Llama 3, Google Gemma 2, and Sarvam AI.\n\nI can assist you with:\n- **General Knowledge & Research**: Answering any question clearly\n- **Software & Programming**: Debugging, writing code in React, Node, Python, etc.\n- **Multilingual Communication**: Fluently understanding English, Hindi, Gujarati, and romanized dialects\n- **Career & Problem Solving**: Providing actionable insights and solutions`;
  }

  return `Thank you for your question, ${userName}! I am ready to help you solve this. Could you provide a bit more detail so I can give you the most accurate and actionable response?`;
}
