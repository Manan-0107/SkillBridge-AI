/**
 * POST /api/resume/save
 *
 * Body: {
 *   filename?:     string
 *   resumeText:    string
 *   targetRole:    string
 *   analysisResult: EnhancedAnalysis
 * }
 *
 * Saves the resume + analysis to the `resume_uploads` Supabase table.
 * Authenticated only (userId derived strictly from session).
 * Validates analysisResult schema and clamps ATS scores.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/supabase/auth";
import { checkRateLimit, checkRateLimitAsync, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { saveResumeWithUserConsistency, getUserResumes, deleteResumeUpload } from "@/lib/db";
import { MAX_RESUME_TEXT_LENGTH } from "@/lib/security/upload";
import type { EnhancedAnalysis } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const resumes = await getUserResumes(userId);
    return NextResponse.json({ success: true, resumes });
  } catch (err) {
    console.error("[api/resume/save] GET error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch resumes" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const url = new URL(req.url, "http://localhost:3000");
    const id = url.searchParams.get("id");
    if (!id || typeof id !== "string" || !id.trim()) {
      return NextResponse.json(
        { success: false, error: "Missing or invalid resume upload id" },
        { status: 400 }
      );
    }

    const result = await deleteResumeUpload(userId, id.trim());
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to delete resume" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/resume/save] DELETE error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Rate limiting: 20 saves / 60 sec per user (generous for autosave/edits while preventing DoS).
    const rl = await checkRateLimitAsync(`resume_save:${userId}`, RATE_LIMIT_PRESETS.resumeSave);
    if (!rl.allowed || rl.isLimited) {
      if (rl.status === 503) {
        return NextResponse.json(
          {
            success: false,
            error: "Service temporarily unavailable. Please try again shortly.",
            code: "SERVICE_UNAVAILABLE",
          },
          { status: 503 }
        );
      }
      return NextResponse.json(
        {
          success: false,
          error: "Too many resume save requests. Please wait a minute before saving again.",
          code: "RATE_LIMITED",
        },
        { status: 429 }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON request payload" },
        { status: 400 }
      );
    }

    const { filename, resumeText, targetRole, analysisResult, structuredResume } = body as {
      filename?: string;
      resumeText: string;
      targetRole: string;
      analysisResult: EnhancedAnalysis;
      structuredResume?: Record<string, unknown>;
    };

    if (!resumeText || typeof resumeText !== "string" || !resumeText.trim()) {
      return NextResponse.json(
        { success: false, error: "resumeText must be a non-empty string" },
        { status: 400 }
      );
    }

    if (resumeText.length > MAX_RESUME_TEXT_LENGTH) {
      return NextResponse.json(
        { success: false, error: `resumeText exceeds maximum allowed length (${MAX_RESUME_TEXT_LENGTH / 1024} KB)` },
        { status: 413 }
      );
    }

    if (!targetRole || typeof targetRole !== "string" || !targetRole.trim()) {
      return NextResponse.json(
        { success: false, error: "targetRole must be a non-empty string" },
        { status: 400 }
      );
    }

    if (targetRole.length > 100) {
      return NextResponse.json(
        { success: false, error: "targetRole exceeds maximum allowed length of 100 characters" },
        { status: 400 }
      );
    }

    if (filename && (typeof filename !== "string" || filename.length > 255)) {
      return NextResponse.json(
        { success: false, error: "filename exceeds maximum allowed length of 255 characters" },
        { status: 400 }
      );
    }

    // Schema validation for analysisResult
    if (
      !analysisResult ||
      typeof analysisResult !== "object" ||
      typeof analysisResult.overallScore !== "number" ||
      Number.isNaN(analysisResult.overallScore)
    ) {
      return NextResponse.json(
        { success: false, error: "analysisResult must be an object with numeric overallScore" },
        { status: 400 }
      );
    }

    if (!Array.isArray(analysisResult.matchedSkills) || !Array.isArray(analysisResult.missingSkills)) {
      return NextResponse.json(
        { success: false, error: "analysisResult must include matchedSkills and missingSkills arrays" },
        { status: 400 }
      );
    }

    // Clamp score to 0..100
    const clampedScore = Math.max(0, Math.min(100, Math.round(analysisResult.overallScore)));

    const analysisJson: Record<string, unknown> = {
      ...(analysisResult as unknown as Record<string, unknown>),
    };
    if (structuredResume && typeof structuredResume === "object") {
      analysisJson.structuredResume = structuredResume;
    }

    const result = await saveResumeWithUserConsistency({
      userId,
      filename: (typeof filename === "string" && filename.trim()) ? filename.trim() : "resume",
      resumeText: resumeText.trim(),
      targetRole: targetRole.trim(),
      atsScore: clampedScore,
      matchedSkills: analysisResult.matchedSkills.map(String),
      missingSkills: analysisResult.missingSkills.map(String),
      analysisJson,
    });

    if (result.error || !result.uploadId) {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to persist resume upload" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, uploadId: result.uploadId });
  } catch (err) {
    console.error("[api/resume/save] Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
