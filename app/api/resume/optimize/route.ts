/**
 * POST /api/resume/optimize
 *
 * Free AI Resume Bullet Point & Summary Optimizer:
 * Converts raw experience lines into high-impact Google XYZ formula bullets
 * ("Accomplished [X] as measured by [Y] by doing [Z]").
 *
 * Authenticated only. Request size limited to 64KB.
 * Validates AI output schema and gracefully falls back to deterministic heuristic generation.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import crypto from "crypto";

export const runtime = "nodejs";

const MAX_TEXT_LENGTH = 64 * 1024; // 64 KB

const ACTION_VERBS: Record<string, string[]> = {
  frontend: ["Architected", "Engineered", "Optimized", "Refactored", "Spearheaded", "Implemented", "Designed", "Standardized"],
  backend: ["Constructed", "Scaled", "Streamlined", "Orchestrated", "Decoupled", "Accelerated", "Automated", "Deployed"],
  data: ["Formulated", "Extracted", "Modeled", "Trained", "Forecasted", "Synthesized", "Transformed", "Analyzed"],
  product: ["Spearheaded", "Prioritized", "Launched", "Mobilized", "Iterated", "Validated", "Aligned", "Boosted"],
  design: ["Crafted", "Iterated", "Standardized", "Transformed", "Prototype-tested", "Elevated", "Harmonized"],
  devops: ["Automated", "Containerized", "Provisioned", "Hardened", "Monitored", "Migrated", "Orchestrated"],
};

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json(
        {
          code: "UNAUTHORIZED",
          message: "Authentication required to optimize resume content.",
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

    const { text, role = "frontend", type = "bullet" } = (body || {}) as {
      text?: string;
      role?: string;
      type?: "bullet" | "summary" | "skills";
    };

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json(
        {
          code: "BAD_REQUEST",
          message: "text must be a non-empty string.",
          retryable: false,
          requestId,
        },
        { status: 400 }
      );
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        {
          code: "PAYLOAD_TOO_LARGE",
          message: `Text exceeds maximum allowed length (${MAX_TEXT_LENGTH / 1024} KB).`,
          retryable: false,
          requestId,
        },
        { status: 413 }
      );
    }

    const trimmed = text.trim();
    const safeRole = typeof role === "string" ? role.toLowerCase() : "frontend";
    const verbs = ACTION_VERBS[safeRole] || ACTION_VERBS.frontend;
    const randomVerb = verbs[Math.floor(Math.random() * verbs.length)];

    // 1. Try Free Multi-Model Engine for AI Optimization
    const optimized = await runAiOptimization(trimmed, safeRole, type);
    if (optimized) {
      return NextResponse.json(optimized);
    }

    // 2. Fallback Heuristic Optimization (Google XYZ Formula)
    const fallbackVariants = generateHeuristicVariants(trimmed, safeRole, randomVerb, type);
    return NextResponse.json(fallbackVariants);
  } catch (error: any) {
    console.error(`[Optimize API] Error (${requestId}):`, error?.message || "Optimization error");
    return NextResponse.json(
      {
        code: "INTERNAL_ERROR",
        message: "Failed to optimize resume content.",
        retryable: true,
        requestId,
      },
      { status: 500 }
    );
  }
}

// ─── AI Bullet / Summary Optimizer Engine ─────────────────────────────────────
async function runAiOptimization(text: string, role: string, type: string) {
  const prompt = `You are a Principal Resume Evaluator.
Rewrite and optimize the following ${type} for a ${role} resume.
Follow the Google XYZ formula: "Accomplished [X] as measured by [Y] by doing [Z]".

CRITICAL FACTUAL INTEGRITY INSTRUCTIONS:
- STRICTLY PRESERVE FACTUAL INTEGRITY.
- DO NOT FABRICATE OR INVENT fake metrics, percentages, team sizes, dollar amounts, or technologies not present in the user's input.
- Strengthen action verbs, technical clarity, concise phrasing, and ATS keyword relevance.
- If a measurable metric is absent in the input, provide a clear bracketed placeholder prompt (e.g., "[quantifiable metric: e.g. % faster, latency, or scale]") so the candidate can insert authentic figures.

Original text:
"${text}"

Respond ONLY with valid JSON in this exact structure:
{
  "optimized": "Polished high-impact version with strong action verbs and factual integrity preserved",
  "alternatives": [
    "Alternative 1 (technical clarity focused)",
    "Alternative 2 (collaboration and delivery focused)"
  ],
  "atsKeywordsAdded": ["keyword1", "keyword2"],
  "scoreImprovement": "Transformed passive phrasing to strong action verb (Factual preservation)",
  "metricPrompt": "Guidance on authentic metrics to consider adding"
}`;

  try {
    const { generateAIResponse } = await import("@/lib/ai/centralProvider");
    const aiResult = await generateAIResponse({
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      maxTokens: 500,
      timeoutMs: 8000,
    });

    const raw = aiResult.text || "";
    const clean = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(clean);
    if (isValidOptimization(parsed)) return parsed;
  } catch (aiErr) {
    console.warn("[optimize] AI optimization note:", aiErr);
  }

  return null;
}

function isValidOptimization(parsed: any): boolean {
  return (
    parsed &&
    typeof parsed === "object" &&
    typeof parsed.optimized === "string" &&
    parsed.optimized.trim().length > 0 &&
    Array.isArray(parsed.alternatives) &&
    Array.isArray(parsed.atsKeywordsAdded)
  );
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
      optimized: `Results-driven ${role} specialist experienced in building scalable solutions, streamlining feature delivery, and maintaining robust system performance.`,
      alternatives: [
        `Proactive ${role} practitioner focused on clean architecture, modern component design, and efficient cross-functional team collaboration.`,
        `Dedicated ${role} contributor with a strong foundation in end-to-end development, code maintainability, and user-centric workflows.`,
      ],
      atsKeywordsAdded: ["Scalability", "System Architecture", "Best Practices", "Cross-Functional Collaboration"],
      scoreImprovement: "Enhanced active voice and role clarity (Factual preservation)",
      metricPrompt: "Tip: If you have measurable metrics (e.g. latency reduction %, user scale), add them to quantify your impact.",
    };
  }

  // Bullet Point: Action verb + user facts + prompt to quantify if not present
  const lowerStart = clean.charAt(0).toLowerCase() + clean.slice(1);
  const primaryOptimized = `${verb} ${lowerStart}, optimizing delivery and code reliability [insert measurable outcome, e.g., latency or usage].`;

  return {
    optimized: primaryOptimized,
    alternatives: [
      `Engineered ${lowerStart} to streamline workflows and improve maintainability across production modules.`,
      `Implemented and standardized ${lowerStart} adhering to industry best practices and ATS guidelines.`,
    ],
    atsKeywordsAdded: [verb, "System Performance", "Modular Architecture"],
    scoreImprovement: "Transformed passive phrasing to strong action verb (Factual preservation)",
    metricPrompt: "Tip: Replace bracketed text with your authentic performance or adoption metric to complete the XYZ formula.",
  };
}
