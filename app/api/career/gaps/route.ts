/**
 * app/api/career/gaps/route.ts
 *
 * Authenticated Dynamic Career Gap Explainer Endpoint
 *
 * Explains identified skill gaps using verified candidate evidence,
 * concrete engineering rationale, and targeted roadmap actions.
 * Never invents scores or produces unexplained claims.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/supabase/auth";
import { getUserEvidenceWalletAsync } from "@/lib/career/evidenceWallet";
import { explainSkillGap } from "@/lib/career/gapExplainer";
import { roleOptions } from "@/lib/data";
import { getOrGenerateCorrelationId } from "@/lib/observability/correlation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const correlationId = getOrGenerateCorrelationId(req.headers);
  const userId = await getAuthenticatedUserId(req);

  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Authentication required to inspect skill gaps." },
      { status: 401, headers: { "x-correlation-id": correlationId } }
    );
  }

  const { searchParams } = new URL(req.url);
  const targetSkill = searchParams.get("skill");
  const targetRole = searchParams.get("role") || "Frontend Developer";

  try {
    const userEvidence = await getUserEvidenceWalletAsync(userId);

    if (targetSkill) {
      const explanation = explainSkillGap(targetSkill, userEvidence, targetRole);
      return NextResponse.json(
        {
          success: true,
          userId,
          targetRole,
          explanation,
          evidenceCount: userEvidence.length,
        },
        { status: 200, headers: { "x-correlation-id": correlationId } }
      );
    }

    // If no single skill requested, analyze prominent skills for the target role
    const defaultTrackSkills = ["typescript", "react", "nextjs", "docker", "postgresql", "testing"];
    const verifiedSkillIds = new Set(
      userEvidence.filter((e) => e.status === "CONFIRMED").map((e) => e.skillId)
    );

    const gapExplanations = defaultTrackSkills.map((skillId) => {
      const hasEvidence = verifiedSkillIds.has(skillId);
      return {
        skillId,
        isGap: !hasEvidence,
        explanation: explainSkillGap(skillId, userEvidence, targetRole),
      };
    });

    return NextResponse.json(
      {
        success: true,
        userId,
        targetRole,
        gaps: gapExplanations,
        totalEvidenceItems: userEvidence.length,
        hasSufficientEvidence: userEvidence.length > 0,
      },
      { status: 200, headers: { "x-correlation-id": correlationId } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: err?.message || "Failed to analyze career gaps." },
      { status: 500, headers: { "x-correlation-id": correlationId } }
    );
  }
}
