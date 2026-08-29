/**
 * POST /api/resume/optimize
 *
 * Free AI Resume Bullet Point & Summary Optimizer:
 * Converts raw experience lines into high-impact Google XYZ formula bullets
 * ("Accomplished [X] as measured by [Y] by doing [Z]").
 *
 * Body: {
 *   text: string;
 *   role?: string;
 *   type?: "bullet" | "summary" | "skills";
 * }
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const ACTION_VERBS: Record<string, string[]> = {
  frontend: ["Architected", "Engineered", "Optimized", "Refactored", "Spearheaded", "Implemented", "Designed", "Standardized"],
  backend: ["Constructed", "Scaled", "Streamlined", "Orchestrated", "Decoupled", "Accelerated", "Automated", "Deployed"],
  data: ["Formulated", "Extracted", "Modeled", "Trained", "Forecasted", "Synthesized", "Transformed", "Analyzed"],
  product: ["Spearheaded", "Prioritized", "Launched", "Mobilized", "Iterated", "Validated", "Aligned", "Boosted"],
  design: ["Crafted", "Iterated", "Standardized", "Transformed", "Prototype-tested", "Elevated", "Harmonized"],
  devops: ["Automated", "Containerized", "Provisioned", "Hardened", "Monitored", "Migrated", "Orchestrated"],
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, role = "frontend", type = "bullet" } = body as {
      text: string;
      role?: string;
      type?: "bullet" | "summary" | "skills";
    };

    if (!text || !text.trim()) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const trimmed = text.trim();
    const verbs = ACTION_VERBS[role] || ACTION_VERBS.frontend;
    const randomVerb = verbs[Math.floor(Math.random() * verbs.length)];

    // ─── 1. Try Free Multi-Model Engine for AI Optimization ───────────────────
    const optimized = await runAiOptimization(trimmed, role, type);
    if (optimized) {
      return NextResponse.json(optimized);
    }

    // ─── 2. Fallback Heuristic Optimization (Google XYZ Formula) ──────────────
    const fallbackVariants = generateHeuristicVariants(trimmed, role, randomVerb, type);
    return NextResponse.json(fallbackVariants);
  } catch (error) {
    console.error("[Optimize API] Error:", error);
    return NextResponse.json(
      { error: "Internal optimization error" },
      { status: 500 }
    );
  }
}

// ─── AI Bullet / Summary Optimizer Engine ─────────────────────────────────────
async function runAiOptimization(text: string, role: string, type: string) {
  const prompt = `You are a Principal Resume Evaluator at Google/Meta.
Rewrite and optimize the following ${type} for a ${role} resume.
Follow the Google XYZ formula: "Accomplished [X] as measured by [Y] by doing [Z]".
Make it punchy, metric-driven, and ATS-compliant.

Original text:
"${text}"

Respond ONLY with valid JSON in this exact structure:
{
  "optimized": "Primary polished high-impact version with strong action verbs and quantified impact",
  "alternatives": [
    "Alternative 1 (metric & speed focused)",
    "Alternative 2 (leadership & architecture focused)"
  ],
  "atsKeywordsAdded": ["keyword1", "keyword2", "keyword3"],
  "scoreImprovement": "+24% ATS Parser Legibility"
}`;

  // Try GitHub Models / Open-Source endpoint
  const token = process.env.GITHUB_TOKEN || process.env.GITHUB_MODELS_TOKEN;
  if (token && token.trim().length > 5) {
    try {
      const res = await fetch("https://models.inference.ai.azure.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          model: "gpt-4o-mini",
          temperature: 0.3,
          max_tokens: 500,
        }),
        signal: AbortSignal.timeout(6000),
      });

      if (res.ok) {
        const data = await res.json();
        const raw = data?.choices?.[0]?.message?.content || "";
        const clean = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
        return JSON.parse(clean);
      }
    } catch {
      // fallback
    }
  }

  // Try Free Pollinations AI endpoint
  try {
    const res = await fetch("https://text.pollinations.ai/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        model: "openai",
        seed: 42,
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const raw = await res.text();
      const clean = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
      const parsed = JSON.parse(clean);
      if (parsed.optimized) return parsed;
    }
  } catch {
    // fallback
  }

  return null;
}

// ─── Fallback Heuristic Generation ────────────────────────────────────────────
function generateHeuristicVariants(
  rawText: string,
  role: string,
  verb: string,
  type: string
) {
  const clean = rawText.replace(/^[•\-\*]\s*/, "").replace(/\.+$/, "");

  if (type === "summary") {
    return {
      optimized: `Results-driven ${role} engineer with proven track record in architecting high-availability systems, optimizing core performance by over 30%, and delivering scalable full-stack features from initial design to production deployment.`,
      alternatives: [
        `High-impact ${role} professional specializing in modern component architecture, automated CI/CD pipelines, and cross-functional leadership across agile teams.`,
        `Passionate ${role} builder focused on metric-driven user experiences, clean code patterns, and cutting latency across production workflows.`,
      ],
      atsKeywordsAdded: ["Scalability", "System Architecture", "Performance Optimization", "Agile Execution"],
      scoreImprovement: "+28% ATS Parser Legibility",
    };
  }

  // Bullet Point
  const primaryOptimized = `${verb} ${clean.charAt(0).toLowerCase() + clean.slice(1)}, improving system responsiveness and efficiency by 34% across 10k+ active sessions.`;

  return {
    optimized: primaryOptimized,
    alternatives: [
      `Spearheaded modular implementation of ${clean.toLowerCase()}, reducing build latency by 42% and eliminating critical bottlenecks.`,
      `Engineered and deployed scalable ${clean.toLowerCase()} utilizing modern design standards, accelerating release cycles by 25%.`,
    ],
    atsKeywordsAdded: [verb, "System Performance", "Modular Architecture", "Metric-Driven Delivery"],
    scoreImprovement: "+35% Impact Rating",
  };
}
