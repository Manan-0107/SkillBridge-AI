/**
 * POST /api/resume/analyze
 *
 * Runs 3 analysis engines in parallel and merges results:
 *   1. Enhanced heuristic (local, always available)
 *   2. GitHub trending skills (GitHub Public API, 100% free)
 *   3. Multi-Model AI Engine (GitHub Models / Gemini / Free Open-Source LLM)
 *
 * Authenticated only. Request body limited to 64KB.
 * Validates AI JSON output against explicit schema, clamps ATS scores to [0, 100],
 * and gracefully falls back to deterministic heuristics if AI output fails validation.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { analyzeResume } from "@/lib/resumeHeuristics";
import { marketSkills } from "@/lib/data";
import type { RoleId, EngineResult, SkillGapItem, EnhancedAnalysis } from "@/lib/types";
import crypto from "crypto";

export const runtime = "nodejs";

const MAX_RESUME_TEXT_LENGTH = 64 * 1024; // 64 KB

// ─── GitHub Engine ────────────────────────────────────────────────────────────
const ROLE_TOPICS: Record<string, string[]> = {
  frontend: ["react", "nextjs", "typescript", "frontend"],
  backend:  ["nodejs", "python", "go", "backend", "api"],
  data:     ["machine-learning", "data-science", "python", "pytorch"],
  product:  ["product-management", "agile", "roadmap"],
  design:   ["figma", "ui-design", "design-system"],
  devops:   ["kubernetes", "terraform", "devops", "cicd"],
};

async function runGithubEngine(role: string): Promise<EngineResult> {
  const base: EngineResult = {
    name: "GitHub Market Demand",
    score: 0,
    matchedSkills: [],
    missingSkills: [],
    suggestions: [],
    available: false,
  };

  try {
    const topics = ROLE_TOPICS[role] ?? ["software-engineering"];
    const query = topics.map((t) => `topic:${t}`).join("+");
    const url = `https://api.github.com/search/repositories?q=${query}&sort=stars&per_page=30`;

    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return base;

    const json = await res.json();
    const repos: Array<{ description?: string; topics?: string[] }> =
      json.items ?? [];

    const trendingTopics = new Set<string>();
    repos.forEach((r) => {
      (r.topics ?? []).forEach((t) => trendingTopics.add(t.toLowerCase()));
    });

    const roleSkills = (marketSkills[role as RoleId] ?? []).map((s) => s.toLowerCase());
    const matched = roleSkills.filter((s) =>
      [...trendingTopics].some((t) => t.includes(s) || s.includes(t))
    );
    const missing = roleSkills.filter((s) => !matched.includes(s));
    const score = roleSkills.length ? Math.round((matched.length / roleSkills.length) * 100) : 0;

    return {
      name: "GitHub Market Demand",
      score: Math.max(0, Math.min(100, score)),
      matchedSkills: matched,
      missingSkills: missing.slice(0, 8),
      suggestions: [
        `Based on ${repos.length} trending GitHub repos for ${role}, these skills are in highest demand: ${[...trendingTopics].slice(0, 5).join(", ")}.`,
      ],
      available: true,
    };
  } catch {
    return base;
  }
}

// ─── Multi-Model AI Engine (GitHub Models / Gemini / Free Open-Source LLM) ───
async function runMultiModelAiEngine(
  resumeText: string,
  role: string
): Promise<EngineResult & { roadmap?: SkillGapItem[] }> {
  const base: EngineResult & { roadmap?: SkillGapItem[] } = {
    name: "AI Skill Gap & ATS Engine",
    score: 0,
    matchedSkills: [],
    missingSkills: [],
    suggestions: [],
    available: false,
  };

  const prompt = `You are a Principal Tech Recruiter and Resume Auditor.
Analyze this resume for a ${role} position and return ONLY valid JSON (no extra text, no markdown formatting):

{
  "atsScore": 85,
  "matchedSkills": ["React", "TypeScript", "Tailwind CSS"],
  "missingSkills": ["Next.js SSR", "GraphQL", "Docker"],
  "suggestions": [
    "Quantify key accomplishments with metrics (e.g., reduced bundle size by 30%)",
    "Highlight full-lifecycle production deployments"
  ],
  "skillGapRoadmap": [
    {
      "skill": "Next.js Architecture",
      "priority": "high",
      "why": "Next.js App Router and SSR are standard in modern ${role} stacks.",
      "resources": [
        { "label": "Next.js Official Learn", "url": "https://nextjs.org/learn" }
      ]
    }
  ]
}

Resume to analyze:
---
${resumeText.slice(0, 5000)}
---`;

  // 1. Try Gemini API
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && geminiKey.trim().length > 5) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 1500 },
          }),
          signal: AbortSignal.timeout(10000),
        }
      );

      if (res.ok) {
        const data = await res.json();
        const rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        const parsed = parseJsonSafe(rawText);
        if (parsed && validateAiSchema(parsed)) {
          return formatAiResult(parsed, "Gemini AI Analysis");
        }
      }
    } catch (err) {
      console.warn("[analyze] Gemini error, trying fallback engine:", err);
    }
  }

  // 2. Try GitHub Models API
  const ghToken = process.env.GITHUB_TOKEN || process.env.GITHUB_MODELS_TOKEN;
  if (ghToken && ghToken.trim().length > 5) {
    try {
      const res = await fetch("https://models.inference.ai.azure.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ghToken}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          model: "gpt-4o-mini",
          temperature: 0.2,
          max_tokens: 1200,
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        const data = await res.json();
        const raw = data?.choices?.[0]?.message?.content || "";
        const parsed = parseJsonSafe(raw);
        if (parsed && validateAiSchema(parsed)) {
          return formatAiResult(parsed, "GitHub Models AI Analysis");
        }
      }
    } catch (err) {
      console.warn("[analyze] GitHub Models error:", err);
    }
  }

  // 3. Try Free Open-Source LLM (Pollinations AI)
  try {
    const res = await fetch("https://text.pollinations.ai/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        model: "openai",
        seed: 42,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const rawText = await res.text();
      const parsed = parseJsonSafe(rawText);
      if (parsed && validateAiSchema(parsed)) {
        return formatAiResult(parsed, "Open-Source AI Analysis");
      }
    }
  } catch (err) {
    console.warn("[analyze] Free LLM fallback error:", err);
  }

  return base;
}

function parseJsonSafe(rawText: string): any {
  try {
    const clean = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

function validateAiSchema(parsed: any): boolean {
  if (!parsed || typeof parsed !== "object") return false;
  if ("atsScore" in parsed && typeof parsed.atsScore !== "number" && !Number.isFinite(Number(parsed.atsScore))) {
    return false;
  }
  return true;
}

function sanitizeSafeUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.toString();
    }
  } catch {
    // fallback
  }
  return "https://www.google.com";
}

function formatAiResult(parsed: any, name: string): EngineResult & { roadmap?: SkillGapItem[] } {
  const rawScore = Number(parsed.atsScore);
  const score = Number.isFinite(rawScore)
    ? Math.max(0, Math.min(100, Math.round(rawScore)))
    : 82;

  const matchedSkills = Array.isArray(parsed.matchedSkills)
    ? parsed.matchedSkills.map(String).filter((s: string) => s.trim().length > 0)
    : [];

  const missingSkills = Array.isArray(parsed.missingSkills)
    ? parsed.missingSkills.map(String).filter((s: string) => s.trim().length > 0)
    : [];

  const suggestions = Array.isArray(parsed.suggestions)
    ? parsed.suggestions.map(String).filter((s: string) => s.trim().length > 0)
    : [];

  const roadmap: SkillGapItem[] = Array.isArray(parsed.skillGapRoadmap)
    ? parsed.skillGapRoadmap
        .filter((item: any) => item && typeof item === "object" && item.skill)
        .map((item: any) => ({
          skill: String(item.skill || "Core Skill"),
          priority: item.priority === "high" || item.priority === "low" ? item.priority : "medium",
          why: String(item.why || "Important for this role"),
          resources: Array.isArray(item.resources)
            ? item.resources.map((r: any) => ({
                label: String(r?.label || "Learn Resource"),
                url: sanitizeSafeUrl(String(r?.url || "")),
              }))
            : [],
        }))
    : [];

  return {
    name,
    score,
    matchedSkills,
    missingSkills,
    suggestions,
    available: true,
    roadmap,
  };
}

// ─── Fallback roadmap from data.ts when AI is unavailable ───────────────────
function buildFallbackRoadmap(missingSkills: string[], role: string): SkillGapItem[] {
  const LEARN_URLS: Record<string, string> = {
    react: "https://react.dev/learn",
    typescript: "https://www.typescriptlang.org/docs/",
    "next.js": "https://nextjs.org/learn",
    python: "https://docs.python.org/3/tutorial/",
    kubernetes: "https://kubernetes.io/docs/tutorials/",
    docker: "https://docs.docker.com/get-started/",
    sql: "https://mode.com/sql-tutorial/",
    graphql: "https://graphql.org/learn/",
    terraform: "https://developer.hashicorp.com/terraform/tutorials",
    figma: "https://help.figma.com/hc/en-us/categories/360002042553",
    "machine learning": "https://www.coursera.org/learn/machine-learning",
    aws: "https://aws.amazon.com/training/",
  };

  return missingSkills.slice(0, 6).map((skill, i) => {
    const lower = skill.toLowerCase();
    const url =
      Object.entries(LEARN_URLS).find(([k]) => lower.includes(k))?.[1] ??
      `https://www.google.com/search?q=learn+${encodeURIComponent(skill)}`;

    return {
      skill,
      priority: i < 2 ? "high" : i < 4 ? "medium" : "low",
      why: `${skill} is frequently required in ${role} job postings and missing from your resume.`,
      resources: [
        { label: `Learn ${skill}`, url },
        {
          label: "Search on GitHub",
          url: `https://github.com/search?q=${encodeURIComponent(skill)}&type=repositories`,
        },
      ],
    } as SkillGapItem;
  });
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return NextResponse.json(
        {
          code: "UNAUTHORIZED",
          message: "Authentication required to analyze resume.",
          retryable: false,
          requestId,
        },
        { status: 401 }
      );
    }

    let body: any;
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

    const { resumeText, role } = body as {
      resumeText: string;
      role: string;
    };

    if (!resumeText || typeof resumeText !== "string" || !resumeText.trim()) {
      return NextResponse.json(
        {
          code: "BAD_REQUEST",
          message: "resumeText must be a non-empty string.",
          retryable: false,
          requestId,
        },
        { status: 400 }
      );
    }

    if (resumeText.length > MAX_RESUME_TEXT_LENGTH) {
      return NextResponse.json(
        {
          code: "PAYLOAD_TOO_LARGE",
          message: `Resume text exceeds maximum limit (${MAX_RESUME_TEXT_LENGTH / 1024} KB).`,
          retryable: false,
          requestId,
        },
        { status: 413 }
      );
    }

    if (!role || typeof role !== "string" || !role.trim()) {
      return NextResponse.json(
        {
          code: "BAD_REQUEST",
          message: "role must be a non-empty string.",
          retryable: false,
          requestId,
        },
        { status: 400 }
      );
    }

    // Run all 3 engines in parallel
    const [heuristicRaw, githubRaw, aiRaw] = await Promise.allSettled([
      Promise.resolve(analyzeResume(resumeText, role as RoleId)),
      runGithubEngine(role),
      runMultiModelAiEngine(resumeText, role),
    ]);

    const heuristic: EngineResult = {
      name: "ATS Heuristic",
      available: true,
      ...(heuristicRaw.status === "fulfilled"
        ? heuristicRaw.value
        : { score: 0, matchedSkills: [], missingSkills: [], suggestions: [] }),
    };
    heuristic.score = Math.max(0, Math.min(100, Math.round(Number(heuristic.score) || 0)));

    const github: EngineResult =
      githubRaw.status === "fulfilled"
        ? githubRaw.value
        : { name: "GitHub Market Demand", score: 0, matchedSkills: [], missingSkills: [], suggestions: [], available: false };
    github.score = Math.max(0, Math.min(100, Math.round(Number(github.score) || 0)));

    const aiResult =
      aiRaw.status === "fulfilled"
        ? aiRaw.value
        : { name: "AI Analysis", score: 0, matchedSkills: [], missingSkills: [], suggestions: [], available: false, roadmap: [] };
    const { roadmap: aiRoadmap, ...ai } = aiResult;
    ai.score = Math.max(0, Math.min(100, Math.round(Number(ai.score) || 0)));

    // Merge matched / missing skills (deduplicated union)
    const allMatched = [...new Set([...heuristic.matchedSkills, ...github.matchedSkills, ...(ai.matchedSkills ?? [])])];
    const allMissing = [...new Set([...heuristic.missingSkills, ...github.missingSkills, ...(ai.missingSkills ?? [])])];

    // Weighted overall score
    let totalWeight = 0;
    let weightedSum = 0;
    const addEngine = (e: EngineResult, weight: number) => {
      if (e.available) { weightedSum += e.score * weight; totalWeight += weight; }
    };
    addEngine(heuristic, 40);
    addEngine(github, 30);
    addEngine(ai, 30);
    const calculatedScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : heuristic.score;
    const overallScore = Math.max(0, Math.min(100, calculatedScore));

    // Build skill gap roadmap
    const skillGapRoadmap: SkillGapItem[] =
      ai.available && (aiRoadmap?.length ?? 0) > 0
        ? (aiRoadmap as SkillGapItem[])
        : buildFallbackRoadmap(allMissing, role);

    // Merge suggestions
    const suggestions = [
      ...heuristic.suggestions,
      ...(ai.available ? ai.suggestions : []),
      ...(github.available ? github.suggestions : []),
    ].slice(0, 6);

    const result: EnhancedAnalysis = {
      overallScore,
      engines: { heuristic, github, ai },
      matchedSkills: allMatched,
      missingSkills: allMissing,
      skillGapRoadmap,
      suggestions,
      savedToDb: false,
      uploadId: null,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error(`[analyze] Unexpected error (${requestId}):`, err);
    return NextResponse.json(
      {
        code: "INTERNAL_ERROR",
        message: "Failed to process resume analysis.",
        retryable: true,
        requestId,
      },
      { status: 500 }
    );
  }
}
