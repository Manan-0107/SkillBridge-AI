/**
 * POST /api/resume/save
 *
 * Body: {
 *   filename:      string
 *   resumeText:    string
 *   targetRole:    string
 *   analysisResult: EnhancedAnalysis
 * }
 *
 * The owning user is taken from the authenticated session (`cf_uid` cookie),
 * never from the request body — a client cannot save rows for another user.
 * `middleware.ts` already 401s requests without a session; this re-checks as
 * defense in depth.
 *
 * Returns: { success: boolean; uploadId: string | null }
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUserIdByEmail, saveResumeUpload } from "@/lib/db";
import { supabaseConfigured } from "@/lib/supabase";
import type { EnhancedAnalysis } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const email = cookies().get("cf_uid")?.value?.trim();
    if (!email) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const userId = await getUserIdByEmail(email);
    if (!userId && supabaseConfigured) {
      // Session cookie present but no matching user row — treat as unauthorized.
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { filename, resumeText, targetRole, analysisResult } = body as {
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

    // userId is null only when Supabase is unconfigured (local dev) — saveResumeUpload no-ops.
    const uploadId = await saveResumeUpload({
      userId: userId ?? "",
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
