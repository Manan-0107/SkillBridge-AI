/**
 * POST /api/resume/save
 *
 * Body: {
 *   userId:        string
 *   filename:      string
 *   resumeText:    string
 *   targetRole:    string
 *   analysisResult: EnhancedAnalysis
 * }
 *
 * Saves the resume + analysis to the `resume_uploads` Supabase table.
 * Returns: { success: boolean; uploadId: string | null }
 */

import { NextRequest, NextResponse } from "next/server";
import { saveResumeUpload } from "@/lib/db";
import type { EnhancedAnalysis } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, filename, resumeText, targetRole, analysisResult } = body as {
      userId: string;
      filename: string;
      resumeText: string;
      targetRole: string;
      analysisResult: EnhancedAnalysis;
    };

    if (!userId || !resumeText || !targetRole) {
      return NextResponse.json(
        { success: false, error: "userId, resumeText, and targetRole are required" },
        { status: 400 }
      );
    }

    const uploadId = await saveResumeUpload({
      userId,
      filename: filename ?? "resume",
      resumeText,
      targetRole,
      atsScore: analysisResult.overallScore,
      matchedSkills: analysisResult.matchedSkills,
      missingSkills: analysisResult.missingSkills,
      analysisJson: analysisResult as unknown as Record<string, unknown>,
    });

    return NextResponse.json({ success: true, uploadId });
  } catch (err) {
    console.error("[save] Unexpected error:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
