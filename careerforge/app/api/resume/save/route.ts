/**
 * POST /api/resume/save
 *
 * Saves the resume + analysis to the `resume_uploads` Supabase table.
 * Uses authoritative getAuthenticatedUserId() to prevent authorization bypass.
 * Returns: { success: boolean; uploadId: string | null }
 */

import { NextRequest, NextResponse } from "next/server";
import { saveResumeUpload } from "@/lib/db";
import { getAuthenticatedUserId } from "@/lib/supabase/auth";
import type { EnhancedAnalysis } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const contentLength = Number(req.headers.get("content-length") || "0");
    if (contentLength > 2 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: "Payload too large. Maximum size is 2MB." },
        { status: 413 }
      );
    }

    const authUserId = await getAuthenticatedUserId();
    if (!authUserId) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { userId, filename, resumeText, targetRole, analysisResult } = body as {
      userId?: string;
      filename?: string;
      resumeText?: string;
      targetRole?: string;
      analysisResult?: EnhancedAnalysis;
    };

    if (!resumeText || !targetRole || !analysisResult) {
      return NextResponse.json(
        { success: false, error: "resumeText, targetRole, and analysisResult are required" },
        { status: 400 }
      );
    }

    // Authorization check: cannot save resume under another user's ID
    if (userId && userId !== authUserId) {
      return NextResponse.json(
        { success: false, error: "Forbidden: Cannot save resume for another user" },
        { status: 403 }
      );
    }

    const uploadId = await saveResumeUpload({
      userId: authUserId,
      filename: (filename ?? "resume").slice(0, 255),
      resumeText: resumeText.slice(0, 100000),
      targetRole: targetRole.slice(0, 100),
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
