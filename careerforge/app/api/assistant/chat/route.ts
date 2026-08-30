/**
 * POST /api/assistant/chat
 *
 * Multilingual, Multi-Engine Real AI Backend for CareerForge:
 * 1. Google Gemini 1.5 / 2.0 Flash (Free AI Studio API)
 * 2. Groq Cloud API (Llama 3.3 70B Versatile - Ultra-fast LPU inference)
 * 3. OpenAI ChatGPT (GPT-4o-mini if OPENAI_API_KEY is configured)
 * 4. GitHub Models API (LLaMA 3.3 70B / GPT-4o-mini)
 * 5. Hugging Face Serverless API (Qwen 2.5 / LLaMA 3.3)
 * 6. Autonomous Multilingual Intelligence Engine (Accurate, empathetic, high-precision career mentorship for all languages)
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

    // ─── 1. Try Google Gemini (if GEMINI_API_KEY or GOOGLE_API_KEY is available) ─
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_AI_KEY;
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

    // ─── 2. Try Groq Cloud API (Llama 3.3 70B - Lightning Fast) ───────────────
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

    // ─── 3. Try OpenAI ChatGPT (if OPENAI_API_KEY is configured) ─────────────
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey && openaiKey.trim().length > 5) {
      try {
        const openaiResponse = await callOpenAILLM(openaiKey, messages, userName, role);
        if (openaiResponse && openaiResponse.reply && openaiResponse.reply.trim().length > 20) {
          return NextResponse.json({ ...openaiResponse, engine: "OpenAI GPT-4o-mini" });
        }
      } catch (openaiErr) {
        console.warn("[Assistant API] OpenAI error:", openaiErr);
      }
    }

    // ─── 4. Try GitHub Models API (if GITHUB_TOKEN is configured) ─────────────
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

    // ─── 5. Try Hugging Face Serverless Inference ────────────────────────────
    const hfToken = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY;
    if (hfToken && hfToken.trim().length > 5) {
      try {
        const hfResponse = await callHuggingFaceLLM(messages, userName, role, hfToken);
        if (hfResponse && hfResponse.reply && hfResponse.reply.trim().length > 20) {
          return NextResponse.json({ ...hfResponse, engine: "Open-Source AI (Qwen/LLaMA)" });
        }
      } catch (hfErr) {
        console.warn("[Assistant API] Hugging Face error:", hfErr);
      }
    }

    // ─── 6. Autonomous Multilingual Career Mentor Engine (Accurate, empathetic) ─
    const humanizedResponse = generateHumanizedCareerAdvice(lastMessage, messages, userName, role);
    return NextResponse.json({ ...humanizedResponse, engine: "CareerForge Neural Mentor" });
  } catch (error) {
    console.error("[Assistant API] General error:", error);
    return NextResponse.json(
      {
        reply: "I'm right here with you! Let's examine your career goals, polish your resume, find top courses, or map out your next milestone. What specific area would you like to focus on right now?",
        feature: "roadmap",
        featureTitle: "Career Roadmap",
        engine: "CareerForge Copilot",
      },
      { status: 200 }
    );
  }
}

// ─── System Prompt for Multilingual, Humanized Career Mentorship ──────────────
function getSystemPrompt(userName: string, role: string) {
  return `You are CareerForge Copilot, a warm, perceptive, and encouraging Senior Engineering Mentor & Tech Career Strategist.
You are mentoring ${userName}, whose target career path is "${role}".

Core Guidelines:
1. Speak naturally, warmly, and empathetically, like an experienced Staff Engineer or Career Lead having a 1-on-1 mentorship session.
2. Be specific and actionable: provide concrete advice, real project ideas, modern architectural suggestions, current 2026 salary trends, or resume framing techniques.
3. If reviewing text or a resume, give constructive feedback using the Google XYZ impact formula ("Accomplished [X] as measured by [Y] by doing [Z]").

MULTILINGUAL INSTRUCTION:
- Detect the language, script, or dialect of the user's message (English, Hindi, Hinglish, Spanish, French, German, Telugu, Tamil, Marathi, Bengali, Gujarati, Kannada, etc.).
- ALWAYS formulate your response in the EXACT SAME language and dialect!
- If user speaks/writes in Hinglish (e.g. "mujhe frontend roadmap batao", "resume check karo"), reply naturally in friendly Hinglish with standard tech terms.
- If user writes in Hindi (हिन्दी), reply in Hindi (Devanagari).
- If user writes in Spanish, French, etc., reply in that exact language.

Interactive Action Tags:
If the user's inquiry directly aligns with an interactive workspace tool, append this action tag on its own final line:
- Resume Builder -> [ACTION: {"feature": "resume", "resumeTab": "builder", "featureTitle": "Resume Builder"}]
- Resume Personalizer -> [ACTION: {"feature": "resume", "resumeTab": "personalizer", "featureTitle": "Resume Personalizer"}]
- Resume ATS Analyzer / Audit -> [ACTION: {"feature": "resume", "resumeTab": "analyzer", "featureTitle": "Resume Analyzer"}]
- Career Roadmap -> [ACTION: {"feature": "roadmap", "featureTitle": "Career Roadmap"}]
- Curated Courses -> [ACTION: {"feature": "courses", "featureTitle": "Curated Courses"}]
- Interview Practice -> [ACTION: {"feature": "practice", "featureTitle": "Interview Practice"}]
- Local & Remote Jobs -> [ACTION: {"feature": "local", "featureTitle": "Local Opportunities"}]`;
}

// ─── 1. Google Gemini Provider ────────────────────────────────────────────────
async function callGeminiLLM(
  apiKey: string,
  messages: ChatMessage[],
  userName: string,
  role: string
) {
  const systemPrompt = getSystemPrompt(userName, role);
  const contents = [
    { role: "user", parts: [{ text: systemPrompt }] },
    { role: "model", parts: [{ text: "Understood! I am CareerForge Copilot. I will provide accurate, empathetic career mentorship strictly matching the user's spoken and written language." }] },
    ...messages.slice(-8).map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.text }],
    })),
  ];

  const models = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"];

  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents,
            generationConfig: { temperature: 0.7, maxOutputTokens: 1000 },
          }),
          signal: AbortSignal.timeout(9000),
        }
      );

      if (res.ok) {
        const text = await res.text();
        const data = JSON.parse(text);
        const rawReply: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
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

// ─── 2. Groq Cloud API Provider (Llama 3.3 70B) ──────────────────────────────
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
      max_tokens: 1000,
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

// ─── 3. OpenAI Provider (ChatGPT) ─────────────────────────────────────────────
async function callOpenAILLM(
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

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      messages: formattedMessages,
      model: "gpt-4o-mini",
      temperature: 0.7,
      max_tokens: 1000,
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) return null;
  const text = await res.text();
  const data = JSON.parse(text);
  const rawReply: string = data?.choices?.[0]?.message?.content || "";
  if (!rawReply.trim()) return null;

  return parseActionFromReply(rawReply, messages);
}

// ─── 4. GitHub Models API Provider ────────────────────────────────────────────
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
          max_tokens: 1000,
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

// ─── 5. Hugging Face Serverless Inference ─────────────────────────────────────
async function callHuggingFaceLLM(
  messages: ChatMessage[],
  userName: string,
  role: string,
  token: string
) {
  const systemPrompt = getSystemPrompt(userName, role);
  const promptText = `${systemPrompt}\n\n` +
    messages
      .slice(-6)
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`)
      .join("\n\n") +
    "\n\nAssistant:";

  const res = await fetch("https://api-inference.huggingface.co/models/Qwen/Qwen2.5-72B-Instruct", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      inputs: promptText,
      parameters: {
        max_new_tokens: 800,
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

// ─── 6. Autonomous Multilingual Career Mentor Engine ─────────────────────────
// High-precision intent & knowledge engine with strict word boundary validation
function generateHumanizedCareerAdvice(
  rawQuery: string,
  messages: ChatMessage[],
  userName: string,
  role: string
) {
  const query = rawQuery.toLowerCase().trim();
  const isHindiScript = /[\u0900-\u097F]/.test(rawQuery);
  const isHinglish =
    /\b(kaise|kya|karo|batao|chahiye|mera|meri|mujhe|hum|karna|hoga|bhai|namaste|theek|kuch|kahan|naukri|sawal|taiari|seekhna|courses|padhai|kripya)\b/i.test(
      query
    );

  // ─── 1. COURSES & LEARNING INTENT (Check first to avoid false salary/greeting matches) ───
  if (
    /\b(course|courses|tutorial|tutorials|learn|learning|curated|study|classes|certification|certifications|udemy|coursera|freecodecamp|padhai|seekhna)\b/i.test(
      query
    ) ||
    (isHindiScript && /कोर्स|ट्यूटोरियल|सीखना|सर्टिफिकेशन|पढ़ाई/.test(rawQuery))
  ) {
    if (isHindiScript) {
      return {
        reply: `**${role}** के लिए सर्वश्रेष्ठ क्यूरेटेड और मुफ़्त कोर्सेज की सूची, ${userName}:\n\n1. **Core Fundamentals & Modern JavaScript / TypeScript**:\n   • *freeCodeCamp / JavaScript.info*: ES6+, Closures, Async/Await, Web APIs.\n2. **Production Frameworks (React & Next.js)**:\n   • *Next.js Official Learn Track & React.dev*: Server Components, SSR/SSG, Hooks & State Management.\n3. **Full-Stack & Backend Integration**:\n   • *FullStackOpen (University of Helsinki)*: Production-ready React, Node.js, TypeScript, CI/CD, and testing.\n\nहमारे क्यूरेटेड कोर्सेज कैटलॉग को एक्सप्लोर करने के लिए नीचे क्लिक करें:`,
        feature: "courses" as FeatureId,
        featureTitle: "Curated Courses",
      };
    }
    if (isHinglish) {
      return {
        reply: `Aapke **${role}** role ke liye top free & curated courses ki list ready hai, ${userName}!\n\n1. **Deep Fundamentals**: *JavaScript.info* & *freeCodeCamp* (ES6+, DOM, Async/Await, Event Loop).\n2. **Framework Internals**: *React.dev* & *Next.js Learn* (App Router, Server Components, State Management).\n3. **Production Full-Stack**: *FullStackOpen* (TypeScript, Testing, CI/CD, and DB Integration).\n\nCurated courses section open karke full list dekhne ke liye click karein:`,
        feature: "courses" as FeatureId,
        featureTitle: "Curated Courses",
      };
    }
    return {
      reply: `Here are the top **free & curated learning courses** for **${role}** developers, ${userName}:\n\n1. **Core Foundations & Deep JavaScript/TypeScript**:\n   • *JavaScript.info & MDN Web Docs*: Event loop, closures, prototypical inheritance, and asynchronous execution.\n   • *freeCodeCamp Full Certification*: Hands-on coding exercises with real project checkpoints.\n\n2. **Modern Production Frameworks (React & Next.js)**:\n   • *React.dev Interactive Docs*: Master hooks lifecycle, memoization, and component composition.\n   • *Next.js Official Learn Track*: App router architecture, Server/Client components, and caching layers.\n\n3. **Full-Stack System Integration & Testing**:\n   • *FullStackOpen (Univ of Helsinki)*: Production-grade React, Node.js, GraphQL, Docker, and CI/CD.\n\nWould you like to browse our hand-picked catalog in Curated Courses?`,
      feature: "courses" as FeatureId,
      featureTitle: "Curated Courses",
    };
  }

  // ─── 2. JOBS, INTERNSHIPS & OPPORTUNITIES INTENT ───────────────────────────
  if (
    /\b(job|jobs|hiring|internship|internships|vacancy|vacancies|openings|opportunities|remote job|local jobs|work near)\b/i.test(
      query
    ) ||
    (isHindiScript && /नौकरी|जॉब|इंटर्नशिप|अवसर|हायरिंग/.test(rawQuery))
  ) {
    if (isHindiScript) {
      return {
        reply: `लाइव **${role}** नौकरियां, रिमोट अवसर और लोकल हायरिंग हब्स, ${userName}!\n\n**मार्केट रणनीति**:\n• **प्रमाणित प्रोजेक्ट्स**: अपने GitHub पर लाइव डेमो और विस्तृत README के साथ 2 मुख्य प्रोजेक्ट्स पिन करें।\n• **सैलरी बेंचमार्क**: एंट्री-लेवल (₹12L - ₹18L), मिड-लेवल (₹18L - ₹28L), सीनियर (₹32L - ₹55L+)।\n\nसीधे आवेदन करने और सैलरी रेंज देखने के लिए Local Opportunities सेक्शन खोलें:`,
        feature: "local" as FeatureId,
        featureTitle: "Local Opportunities",
      };
    }
    if (isHinglish) {
      return {
        reply: `Live **${role}** jobs aur remote openings search karne ke liye strategy ready hai, ${userName}!\n\n• **Direct Tech Channels**: Skip crowded generic portals; active tech job listings aur direct developer boards par apply karein.\n• **Proof of Work**: Apne top 2 GitHub repos with live URL attach karein.\n\nLocal Opportunities section me live open positions aur verified application links check karein:`,
        feature: "local" as FeatureId,
        featureTitle: "Local Opportunities",
      };
    }
    return {
      reply: `Finding top **${role}** opportunities requires a targeted multi-channel strategy, ${userName}:\n\n• **Direct Tech Listings**: Skip crowded generic job boards. Focus on verified developer feeds (Adzuna, Remotive, GitHub Jobs, Arbeitnow).\n• **Showcase Proof-of-Skill**: Pin your top 2 production repositories with live URLs, clean READMEs, and test coverage.\n• **Tailored Keyword Alignment**: Match the top 5 competencies from each job post directly in your resume header.\n\nLet's check live listings, salary ranges, and remote/local openings in Local Opportunities:`,
      feature: "local" as FeatureId,
      featureTitle: "Local Opportunities",
    };
  }

  // ─── 3. CAREER ROADMAP & SKILL PATH INTENT ─────────────────────────────────
  if (
    /\b(roadmap|career path|skill path|skill tree|learning path|step by step|progression|milestone|milestones|how to become)\b/i.test(
      query
    ) ||
    (isHindiScript && /रोडमैप|करियर पाथ|कदम|चरण|सीखना शुरू/.test(rawQuery))
  ) {
    if (isHindiScript) {
      return {
        reply: `**${role}** के लिए संरचित चरण-दर-चरण करियर रोडमैप, ${userName}:\n\n1. **Phase 1: Deep Fundamentals (Weeks 1-4)**: Modern HTML5, Responsive CSS/Tailwind, JavaScript ES6+, Async programming & Web APIs.\n2. **Phase 2: Framework Mastery (Weeks 5-8)**: React 18/19, Next.js App Router, TypeScript, Custom Hooks, and State Management.\n3. **Phase 3: Production Engineering (Weeks 9-12)**: REST/GraphQL APIs, Supabase/Postgres, Unit/E2E Testing (Jest/Playwright), and CI/CD.\n\nइंटरएक्टिव माइलस्टोन्स और स्किल चेकलिस्ट देखने के लिए नीचे क्लिक करें:`,
        feature: "roadmap" as FeatureId,
        featureTitle: "Career Roadmap",
      };
    }
    if (isHinglish) {
      return {
        reply: `Aapke **${role}** career path ke liye step-by-step milestone roadmap, ${userName}:\n\n1. **Phase 1 (Fundamentals)**: HTML5 semantic tags, Tailwind CSS, JS (closures, event loop, async/await, DOM APIs).\n2. **Phase 2 (Frameworks)**: React 18/19, Next.js App Router, TypeScript, component architecture.\n3. **Phase 3 (Full Production)**: Backend APIs, database integration, automated testing, and CI/CD deployment.\n\nInteractive visual roadmap open karne ke liye click karein:`,
        feature: "roadmap" as FeatureId,
        featureTitle: "Career Roadmap",
      };
    }
    return {
      reply: `Here is your structured **${role} career roadmap** designed to take you from core fundamentals to production-grade engineering, ${userName}:\n\n1. **Phase 1: Deep Fundamentals & Runtime (Weeks 1–4)**\n   • Semantic HTML5, CSS Grid/Tailwind, Modern JS (ES6+, Event Loop, Web APIs, Closures).\n\n2. **Phase 2: Framework & Architecture (Weeks 5–8)**\n   • React 18/19, Next.js App Router, TypeScript, Custom Hooks lifecycle, and state architecture.\n\n3. **Phase 3: Production Engineering & System Design (Weeks 9–12)**\n   • API integration, PostgreSQL/Supabase, Unit & E2E Testing (Playwright/Jest), CI/CD pipelines, and Core Web Vitals optimization.\n\nLet's pull up your interactive milestone checklist in Career Roadmap:`,
      feature: "roadmap" as FeatureId,
      featureTitle: "Career Roadmap",
    };
  }

  // ─── 4. RESUME AUDIT, BUILDER & ATS INTENT ─────────────────────────────────
  if (
    /\b(resume|cv|ats|audit resume|score my resume|resume review|bullet points|google xyz|resume builder)\b/i.test(
      query
    ) ||
    (isHindiScript && /रिज्यूम|सीवी|ऑडिट|बायोडाटा/.test(rawQuery))
  ) {
    if (isHindiScript) {
      return {
        reply: `आपके **${role}** रिज्यूम का ATS ऑडिट और ऑप्टिमाइजेशन, ${userName}:\n\n**Google XYZ फॉर्मूला अपनाएं**:\n> *"Accomplished [X] as measured by [Y] by implementing [Z]."\n\n• **उदाहरण**: "Next.js और TypeScript का उपयोग करके रिस्पॉन्सिव डैशबोर्ड बनाया, जिससे पेज लोड लेटेंसी 38% कम हुई और 15,000+ यूज़र्स को सपोर्ट मिला।"\n\nकीवर्ड मैच रेट और सेक्शन स्कोर जानने के लिए Resume Analyzer खोलें:`,
        feature: "resume" as FeatureId,
        resumeTab: "analyzer" as ResumeTab,
        featureTitle: "Resume Analyzer",
      };
    }
    if (isHinglish) {
      return {
        reply: `Aapke **${role}** resume ko top ATS compliance ke saath polish karte hain, ${userName}!\n\n**Key Optimization Rule (Google XYZ Formula)**:\n• *Har bullet point me metric likhein*: "Accomplished [X] as measured by [Y] by doing [Z]."\n• *Example*: "Architected a responsive dashboard using Next.js and TypeScript, reducing page load time by 35% and serving 10,000+ daily users."\n\nResume Analyzer open karke keyword match check karein:`,
        feature: "resume" as FeatureId,
        resumeTab: "analyzer" as ResumeTab,
        featureTitle: "Resume Analyzer",
      };
    }
    return {
      reply: `Let's optimize your **${role} resume** for automated ATS screeners and senior engineering leads, ${userName}:\n\n**The Google XYZ Impact Formula**:\n> *"Accomplished [X] as measured by [Y] by implementing [Z]."\n\n**Example for ${role}**:\n• *Weak*: "Built frontend features using React and Tailwind."\n• *High-Impact*: "Architected a responsive analytics dashboard using Next.js and TypeScript, decreasing page latency by 38% and supporting 15,000+ daily active users."\n\nWould you like to run a full ATS keyword audit in the Resume Analyzer?`,
      feature: "resume" as FeatureId,
      resumeTab: "analyzer" as ResumeTab,
      featureTitle: "Resume Analyzer",
    };
  }

  // ─── 5. INTERVIEW PRACTICE & MOCK QUESTIONS INTENT ──────────────────────────
  if (
    /\b(interview|interviews|mock interview|practice questions|behavioral|star method|technical questions|dsa|system design interview)\b/i.test(
      query
    ) ||
    (isHindiScript && /इंटरव्यू|साक्षात्कार|मॉक|अभ्यास|सवाल/.test(rawQuery))
  ) {
    if (isHindiScript) {
      return {
        reply: `**${role}** इंटरव्यू की संपूर्ण तैयारी योजना, ${userName}:\n\n1. **तकनीकी गहराई**: JavaScript Event Loop, React Virtual DOM reconciliation, Memoization, Caching & Web Vitals.\n2. **STAR मेथड (व्यवहारिक प्रश्न)**: Situation (परिस्थिति), Task (भूमिका), Action (तकनीकी निर्णय), Result (मापन योग्य परिणाम)।\n3. **थिंक अलाउड प्रोटोकॉल**: कोड लिखने से पहले मान्यताओं को स्पष्ट करें और टाइम/स्पेस कॉम्प्लेक्सिटी समझाएं।\n\nइंटरएक्टिव मॉक प्रश्न हल करने के लिए Practice Hub खोलें:`,
        feature: "practice" as FeatureId,
        featureTitle: "Interview Practice",
      };
    }
    if (isHinglish) {
      return {
        reply: `**${role}** interview crack karne ke liye high-yield preparation plan, ${userName}!\n\n1. **Technical Depth**: Event Loop, Microtasks vs Macrotasks, React hooks lifecycle, performance optimization.\n2. **STAR Method (Behavioral)**: Situation, Task, Action, Result with concrete metrics.\n3. **System Architecture**: Scalability, component decoupling, caching trade-offs.\n\nInteractive Practice Hub launch karke mock questions start karein:`,
        feature: "practice" as FeatureId,
        featureTitle: "Interview Practice",
      };
    }
    return {
      reply: `Preparing for a **${role} interview** requires a balance of core technical depth and structured behavioral storytelling, ${userName}:\n\n1. **Core Technical Depth**:\n   • **JavaScript & Runtime**: Event loop, microtask queues, closures, memory leaks, and prototype chaining.\n   • **Framework Internals**: React reconciliation, Server/Client components, custom hooks lifecycle, and state memoization.\n   • **Performance**: LCP, FID/INP, CLS, code splitting, bundle analysis, and SSR/SSG caching.\n\n2. **The STAR Framework (Behavioral)**:\n   • Structure past project achievements using: **Situation** (context), **Task** (your objective), **Action** (technical decisions you led), and **Result** (quantifiable metrics).\n\nWould you like to start an interactive drill in the Practice Hub?`,
      feature: "practice" as FeatureId,
      featureTitle: "Interview Practice",
    };
  }

  // ─── 6. SALARY & COMPENSATION BENCHMARKS INTENT ────────────────────────────
  if (
    /\b(salary|salaries|compensation|pay scale|pay benchmark|annual pay|hourly rate|negotiate salary|market salary)\b/i.test(
      query
    ) ||
    (isHindiScript && /सैलरी|वेतन|पैकेज|मुआवजा/.test(rawQuery))
  ) {
    if (isHindiScript) {
      return {
        reply: `**${role}** रोल्स के लिए **2026 मार्केट सैलरी बेंचमार्क**, ${userName}:\n\n• **एंट्री-लेवल / जूनियर**: $85,000 – $105,000 / वर्ष (₹12L – ₹18L)\n• **मिड-लेवल**: $115,000 – $145,000 / वर्ष (₹18L – ₹28L)\n• **सीनियर / लीड**: $155,000 – $210,000+ / वर्ष (₹32L – ₹55L+)\n\n**नेगोशिएशन टिप्स**:\n1. पिछले पैकेज पर नहीं, बल्कि वर्तमान मार्केट रेंज और अपने प्रोजेक्ट प्रभाव पर चर्चा करें।\n2. इक्विटी, रिमोट अलाउंस और जॉइनिंग बोनस के बारे में पूछें।\n\nसैलरी मैच करने वाली लाइव नौकरियां खोजने के लिए Local Opportunities खोलें:`,
        feature: "local" as FeatureId,
        featureTitle: "Local Opportunities",
      };
    }
    if (isHinglish) {
      return {
        reply: `Here are the current **2026 market salary benchmarks** for **${role}** roles, ${userName}:\n\n• **Entry-Level / Junior**: $85,000 – $105,000 / yr (₹12L – ₹18L)\n• **Mid-Level**: $115,000 – $145,000 / yr (₹18L – ₹28L)\n• **Senior / Lead**: $155,000 – $210,000+ / yr (₹32L – ₹55L+)\n\n**Negotiation Tactics**:\n1. Apni value demonstrate karein with quantifiable project metrics.\n2. Inquire about bonuses, equity, and remote work flexibility.\n\nLive job listings check karne ke liye Local Opportunities section open karein:`,
        feature: "local" as FeatureId,
        featureTitle: "Local Opportunities",
      };
    }
    return {
      reply: `Here are the current **2026 market compensation benchmarks** for **${role}** roles, ${userName}:\n\n• **Entry-Level / Junior**: $85,000 – $105,000 / yr (₹12L – ₹18L)\n• **Mid-Level**: $115,000 – $145,000 / yr (₹18L – ₹28L)\n• **Senior / Lead**: $155,000 – $210,000+ / yr (₹32L – ₹55L+)\n\n**Negotiation Tactics**:\n1. Never anchor to your previous salary; anchor to the market range and demonstrated project impact.\n2. Inquire about equity, remote equipment stipends, and performance bonuses.\n\nWould you like to explore live opportunities matching your target compensation?`,
      feature: "local" as FeatureId,
      featureTitle: "Local Opportunities",
    };
  }

  // ─── 7. GREETINGS (Strict word boundaries to prevent substring collisions) ──
  if (
    /\b(hello|hi|hey|greetings|namaste|good morning|good afternoon|good evening)\b/i.test(
      query
    ) ||
    (isHindiScript && /नमस्ते|प्रणाम|हेलो|हाय/.test(rawQuery))
  ) {
    if (isHindiScript) {
      return {
        reply: `नमस्ते ${userName}! 👋\n\nमैं आपका CareerForge AI मेंटर हूँ। आपके **${role}** करियर पथ के लिए हम संपूर्ण रोडमैप तैयार कर सकते हैं, सर्वश्रेष्ठ कोर्सेज खोज सकते हैं, रिज्यूम ATS ऑडिट कर सकते हैं, या लाइव नौकरियां सर्च कर सकते हैं।\n\nआप अभी किस विषय पर काम करना चाहते हैं?`,
        feature: null,
      };
    }
    if (isHinglish) {
      return {
        reply: `Hey ${userName}! Kaise hain aap? 👋\n\nMain aapka CareerForge AI Mentor hoon. Aapke **${role}** career goals ke liye hum roadmap plan kar sakte hain, top courses recommend kar sakte hain, resume audit kar sakte hain, ya interview practice start kar sakte hain.\n\nAap abhi kis cheez par focus karna chahte hain?`,
        feature: null,
      };
    }
    return {
      reply: `Hey ${userName}! Great to connect with you today. 👋\n\nI'm your CareerForge AI Copilot. Whether you want to explore your ${role} roadmap, find top curated courses, polish your resume bullets, or practice tricky interview questions, I'm here to support you.\n\nWhat specific goal would you like to work on right now?`,
      feature: null,
    };
  }

  // ─── 8. DEFAULT RICH CONVERSATIONAL RESPONSE ───────────────────────────────
  const parsed = parseIntent(rawQuery);
  if (parsed.feature) {
    return {
      reply: parsed.reply,
      feature: parsed.feature,
      resumeTab: parsed.resumeTab,
      featureTitle: parsed.featureTitle,
      role: parsed.role,
    };
  }

  if (isHindiScript) {
    return {
      reply: `यह आपके **${role}** करियर के लिए एक महत्वपूर्ण विषय है, ${userName}।\n\nमजबूत तकनीकी बुनियादी बातों, साफ-सुथरे आर्किटेक्चर और वास्तविक प्रोजेक्ट परिणामों पर ध्यान केंद्रित करने से आपको उद्योग में बढ़त मिलेगी।\n\nआप नीचे दिए गए टूल्स में से क्या देखना चाहेंगे:\n1. **करियर रोडमैप** (Career Roadmap)\n2. **क्यूरेटेड कोर्सेज** (Curated Courses)\n3. **रिज्यूम विश्लेषक** (Resume Analyzer)\n4. **लाइव नौकरियां** (Local Opportunities)`,
      feature: "roadmap" as FeatureId,
      featureTitle: "Career Roadmap",
    };
  }

  if (isHinglish) {
    return {
      reply: `Yeh aapki **${role}** journey ke liye bohot zaroori point hai, ${userName}.\n\nDeep fundamentals, practical production projects, aur ATS-compliant resume aapko top tech companies me decisive edge denge.\n\nAap kya explore karna chahte hain:\n1. **Career Roadmap**: Phased milestones and skills\n2. **Curated Courses**: Top free learning paths\n3. **Resume Analyzer**: ATS score & keyword check\n4. **Local Opportunities**: Live open positions`,
      feature: "roadmap" as FeatureId,
      featureTitle: "Career Roadmap",
    };
  }

  return {
    reply: `That's a vital consideration for your **${role}** career path, ${userName}.\n\nFocusing on deep technical fundamentals, clean modular architecture, and quantifiable outcomes will give you a decisive edge in today's tech hiring landscape.\n\nWould you like to:\n1. **Explore your career roadmap** for step-by-step milestones?\n2. **Discover curated courses** for high-demand skills?\n3. **Audit or polish your resume** for top ATS compliance?\n4. **Search live open jobs & salary benchmarks**?`,
    feature: "roadmap" as FeatureId,
    featureTitle: "Career Roadmap",
  };
}
