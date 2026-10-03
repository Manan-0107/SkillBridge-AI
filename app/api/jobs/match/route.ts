/**
 * POST /api/jobs/match
 *
 * Computes deterministic, explainable match between a Candidate Resume and a NormalizedJob.
 *
 * Input (JSON):
 * - job: NormalizedJob (or LiveJob to be normalized)
 * - resume?: CanonicalResume (optional; if omitted or resumeId passed, fetches user's saved resume)
 * - resumeId?: string (optional saved resume id to match against)
 * - resumeVersionName?: string (e.g. "Full-Stack Senior 2026")
 *
 * Invariant: Never fabricates evidence. Strictly separates MATCHED, PARTIAL, EVIDENCE_GAP, MISSING, and UNKNOWN.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/supabase/auth";
import { checkRateLimit, checkRateLimitAsync, RATE_LIMIT_POLICIES } from "@/lib/security/rateLimit";
import { getUserResumes } from "@/lib/db";
import { parseStructuredResume, type CanonicalResume } from "@/lib/resume/structuredParser";
import { normalizeLiveJob } from "@/lib/career/jobParser";
import { analyzeJobMatch } from "@/lib/career/matchEngine";
import type { NormalizedJob } from "@/lib/career/types";

// FIX #5: Limit request body size to 256KB to prevent CPU-intensive regex attacks
const MAX_MATCH_BODY_BYTES = 256 * 1024;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(req);
    // Note: Matching is available to authenticated users or anonymous with provided resume object
    const rateLimitKey = userId ? `match_auth:${userId}` : `match_anon:${req.headers.get("x-forwarded-for") || "anon"}`;
    const rl = await checkRateLimitAsync(rateLimitKey, RATE_LIMIT_POLICIES.PUBLIC_API);
    if (!rl.allowed || rl.isLimited) {
      if (rl.status === 503) {
        return NextResponse.json(
          { error: "Service temporarily unavailable. Please try again shortly." },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { error: "Too many match requests. Please wait a moment." },
        { status: 429 }
      );
    }

    // FIX #5: Enforce body size limit before JSON parsing
    const contentLength = Number(req.headers.get("content-length") || "0");
    if (contentLength > MAX_MATCH_BODY_BYTES) {
      return NextResponse.json(
        { error: "Request body too large. Maximum allowed is 256KB." },
        { status: 413 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { job, resume, resumeText, resumeId, resumeVersionName } = body;

    if (!job || typeof job !== "object") {
      return NextResponse.json(
        { error: "A valid 'job' object is required." },
        { status: 400 }
      );
    }

    // 1. Ensure NormalizedJob
    let normalizedJob: NormalizedJob;
    if (Array.isArray(job.requirements)) {
      normalizedJob = job as NormalizedJob;
    } else {
      normalizedJob = normalizeLiveJob(job);
    }

    // 2. Resolve Candidate Resume
    let candidateResume: CanonicalResume | null = null;
    let versionName = resumeVersionName || "Current Resume";

    if (resume && typeof resume === "object" && resume.basics && resume.skills) {
      candidateResume = resume as CanonicalResume;
    } else if (resumeText && typeof resumeText === "string" && resumeText.trim()) {
      candidateResume = parseStructuredResume(resumeText);
      versionName = "Pasted Resume Text";
    } else if (userId) {
      // Fetch user's saved resumes
      const userResumes = await getUserResumes(userId);
      if (userResumes && userResumes.length > 0) {
        const targetUpload = resumeId
          ? userResumes.find((r) => r.id === resumeId) || userResumes[0]
          : userResumes[0];

        if (targetUpload) {
          versionName = targetUpload.filename || "Saved Resume";
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
    }

    if (!candidateResume) {
      return NextResponse.json(
        {
          error: "No resume found to match against. Please provide a resume, paste resume text, or sign in with a saved resume.",
          missingResume: true,
        },
        { status: 400 }
      );
    }

    // 3. Deterministic Explainable Match
    const matchResult = analyzeJobMatch({
      job: normalizedJob,
      resume: candidateResume,
      resumeVersionName: versionName,
    });

    return NextResponse.json({ matchResult });
  } catch (err: unknown) {
    console.error("[POST /api/jobs/match] Error:", err);
    return NextResponse.json(
      { error: "Internal error processing job match." },
      { status: 500 }
    );
  }
}
