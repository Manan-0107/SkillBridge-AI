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
import { saveResumeWithUserConsistency } from "@/lib/db";
import type { EnhancedAnalysis } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
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

    const { filename, resumeText, targetRole, analysisResult } = body as {
      filename?: string;
      resumeText: string;
      targetRole: string;
      analysisResult: EnhancedAnalysis;
    };

    if (!resumeText || typeof resumeText !== "string" || !resumeText.trim()) {
      return NextResponse.json(
        { success: false, error: "resumeText must be a non-empty string" },
        { status: 400 }
      );
    }

    if (!targetRole || typeof targetRole !== "string" || !targetRole.trim()) {
      return NextResponse.json(
        { success: false, error: "targetRole must be a non-empty string" },
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

    const result = await saveResumeWithUserConsistency({
      userId,
      filename: (typeof filename === "string" && filename.trim()) ? filename.trim() : "resume",
      resumeText: resumeText.trim(),
      targetRole: targetRole.trim(),
      atsScore: clampedScore,
      matchedSkills: analysisResult.matchedSkills.map(String),
      missingSkills: analysisResult.missingSkills.map(String),
      analysisJson: analysisResult as unknown as Record<string, unknown>,
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
