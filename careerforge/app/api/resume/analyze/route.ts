/**
 * POST /api/resume/analyze
 *
 * Body: { resumeText: string; role: string; userId?: string }
 *
 * Runs 3 analysis engines in parallel and merges results:
 *   1. Enhanced heuristic (local, always available)
 *   2. GitHub trending skills (GitHub API, no key needed)
 *   3. Gemini 1.5 Flash AI (requires GEMINI_API_KEY env var)
 *
 * Returns: EnhancedAnalysis JSON
 */

import { NextRequest, NextResponse } from "next/server";
import { analyzeResume } from "@/lib/resumeHeuristics";
import { marketSkills } from "@/lib/data";
import type { RoleId, EngineResult, SkillGapItem, EnhancedAnalysis } from "@/lib/types";

export const runtime = "nodejs";

// ─── GitHub Engine ────────────────────────────────────────────────────────────
// Maps role → GitHub search topics to find trending repos
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

    // Extract all topics from top repos
    const trendingTopics = new Set<string>();
    repos.forEach((r) => {
      (r.topics ?? []).forEach((t) => trendingTopics.add(t.toLowerCase()));
    });

    // Score: what fraction of role's required skills appear in trending topics
    const roleSkills = (marketSkills[role as RoleId] ?? []).map((s) => s.toLowerCase());
    const matched = roleSkills.filter((s) =>
      [...trendingTopics].some((t) => t.includes(s) || s.includes(t))
    );
    const missing = roleSkills.filter((s) => !matched.includes(s));
    const score = roleSkills.length ? Math.round((matched.length / roleSkills.length) * 100) : 0;

    return {
      name: "GitHub Market Demand",
      score,
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

// ─── Gemini AI Engine ─────────────────────────────────────────────────────────
async function runGeminiEngine(
  resumeText: string,
  role: string
): Promise<EngineResult & { roadmap?: SkillGapItem[] }> {
  const base: EngineResult & { roadmap?: SkillGapItem[] } = {
    name: "Gemini AI Analysis",
    score: 0,
    matchedSkills: [],
    missingSkills: [],
    suggestions: [],
    available: false,
  };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return base;

  const prompt = `You are an expert technical recruiter and career coach.
Analyze this resume for a ${role} role and return ONLY valid JSON (no markdown, no explanation):

{
  "atsScore": <0-100 integer>,
  "matchedSkills": ["skill1", "skill2"],
  "missingSkills": ["skill1", "skill2"],
  "suggestions": ["actionable tip 1", "actionable tip 2"],
  "skillGapRoadmap": [
    {
      "skill": "Skill Name",
      "priority": "high|medium|low",
      "why": "one sentence explaining why this skill matters for ${role}",
      "resources": [
        { "label": "Resource name", "url": "https://..." }
      ]
    }
  ]
}

Resume:
---
${resumeText.slice(0, 6000)}
---`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1500 },
        }),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!res.ok) {
      console.error("[analyze] Gemini API error:", res.status, await res.text());
      return base;
    }

    const data = await res.json();
    const rawText: string =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    // Strip markdown code fences if present
    const jsonText = rawText
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(jsonText);

    return {
      name: "Gemini AI Analysis",
      score: parsed.atsScore ?? 0,
      matchedSkills: parsed.matchedSkills ?? [],
      missingSkills: parsed.missingSkills ?? [],
      suggestions: parsed.suggestions ?? [],
      available: true,
      roadmap: parsed.skillGapRoadmap ?? [],
    };
  } catch (err) {
    console.error("[analyze] Gemini parse error:", err);
    return base;
  }
}

// ─── Fallback roadmap from data.ts when Gemini is unavailable ────────────────
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
  try {
    const body = await req.json();
    const { resumeText, role } = body as {
      resumeText: string;
      role: string;
    };

    if (!resumeText?.trim() || !role) {
      return NextResponse.json(
        { error: "resumeText and role are required" },
        { status: 400 }
      );
    }

    // Run all 3 engines in parallel
    const [heuristicRaw, githubRaw, geminiRaw] = await Promise.allSettled([
      Promise.resolve(analyzeResume(resumeText, role as RoleId)),
      runGithubEngine(role),
      runGeminiEngine(resumeText, role),
    ]);

    const heuristic: EngineResult = {
      name: "ATS Heuristic",
      available: true,
      ...(heuristicRaw.status === "fulfilled"
        ? heuristicRaw.value
        : { score: 0, matchedSkills: [], missingSkills: [], suggestions: [] }),
    };

    const github: EngineResult =
      githubRaw.status === "fulfilled"
        ? githubRaw.value
        : { name: "GitHub Market Demand", score: 0, matchedSkills: [], missingSkills: [], suggestions: [], available: false };

    const geminiResult =
      geminiRaw.status === "fulfilled"
        ? geminiRaw.value
        : { name: "Gemini AI Analysis", score: 0, matchedSkills: [], missingSkills: [], suggestions: [], available: false, roadmap: [] };
    const { roadmap: geminiRoadmap, ...ai } = geminiResult;

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
    const overallScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : heuristic.score;

    // Build skill gap roadmap
    const skillGapRoadmap: SkillGapItem[] =
      ai.available && (geminiRoadmap?.length ?? 0) > 0
        ? (geminiRoadmap as SkillGapItem[])
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
    console.error("[analyze] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
