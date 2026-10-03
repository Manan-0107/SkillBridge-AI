/**
 * /api/applications/copilot
 *
 * Grounded AI Application Copilot Endpoint:
 * - action: "generate_cover_letter" | "generate_answer"
 * - Invariant: Never invents metrics or achievements.
 * - Invariant: Rejects/blocks automated answers to sensitive demographic/legal questions.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/supabase/auth";
import { checkRateLimit, RATE_LIMIT_POLICIES } from "@/lib/security/rateLimit";
import { getUserResumes } from "@/lib/db";
import { parseStructuredResume, type CanonicalResume } from "@/lib/resume/structuredParser";
import { generateCoverLetterDraft, generateQuestionDraft } from "@/lib/career/copilot";
import type { NormalizedJob } from "@/lib/career/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = checkRateLimit(`copilot:${userId}`, RATE_LIMIT_POLICIES.RESUME_GENERATION);
    if (rl.isLimited) {
      return NextResponse.json({ error: "Too many copilot requests. Please wait a moment." }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const { action, job, resume, resumeId, userNotes, question } = body;

    // Resolve resume
    let candidateResume: CanonicalResume | null = null;
    if (resume && typeof resume === "object" && resume.basics && resume.skills) {
      candidateResume = resume as CanonicalResume;
    } else {
      const userResumes = await getUserResumes(userId);
      if (userResumes && userResumes.length > 0) {
        const targetUpload = resumeId
          ? userResumes.find((r) => r.id === resumeId) || userResumes[0]
          : userResumes[0];

        if (
          targetUpload.analysis_json &&
          typeof targetUpload.analysis_json === "object" &&
          (targetUpload.analysis_json as Record<string, unknown>).structuredResume
        ) {
          candidateResume = (targetUpload.analysis_json as Record<string, unknown>).structuredResume as CanonicalResume;
        } else if (targetUpload.resume_text) {
          candidateResume = parseStructuredResume(targetUpload.resume_text);
        }
      }
    }

    if (!candidateResume) {
      return NextResponse.json(
        { error: "No candidate resume found. Please save a resume or provide structured resume data." },
        { status: 400 }
      );
    }

    if (action === "generate_cover_letter") {
      if (!job || !job.title || !job.company) {
        return NextResponse.json({ error: "Job title and company are required." }, { status: 400 });
      }

      const result = generateCoverLetterDraft({
        job: job as NormalizedJob,
        resume: candidateResume,
        userNotes: typeof userNotes === "string" ? userNotes.slice(0, 500) : undefined,
      });

      return NextResponse.json({
        success: true,
        draft: result.draft,
        usedEvidence: result.usedEvidence,
        isDraft: true,
        notice: "Draft generated from verified facts. Review and tailor before submitting.",
      });
    }

    if (action === "generate_answer") {
      if (!question || typeof question !== "string") {
        return NextResponse.json({ error: "Question prompt is required." }, { status: 400 });
      }

      const result = generateQuestionDraft({
        question: question.slice(0, 500),
        resume: candidateResume,
        job: job as NormalizedJob,
      });

      return NextResponse.json({
        success: true,
        draft: result.draft,
        isSensitive: result.isSensitive,
        category: result.category,
        guidance: result.guidance,
        isDraft: true,
      });
    }

    return NextResponse.json({ error: "Invalid copilot action" }, { status: 400 });
  } catch (err: unknown) {
    console.error("[POST /api/applications/copilot] Error:", err);
    return NextResponse.json({ error: "Internal error executing application copilot." }, { status: 500 });
  }
}
