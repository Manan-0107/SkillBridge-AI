/**
 * app/api/career/daily-plan/route.ts
 *
 * UBIX "What Should I Do Today?" & Career Recovery Endpoint
 *
 * Integrates daily time/energy planning with empathetic, non-judgmental
 * career recovery recommendations.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/supabase/auth";
import { getUserEvidenceWalletAsync } from "@/lib/career/evidenceWallet";
import { generateDailyPlan, EnergyLevel, PreferredTaskType } from "@/lib/career/dailyActionEngine";
import { generateRecoveryPlan } from "@/lib/career/careerRecovery";
import { getUserApplications } from "@/lib/db";
import { getOrGenerateCorrelationId } from "@/lib/observability/correlation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const correlationId = getOrGenerateCorrelationId(req.headers);
  const userId = await getAuthenticatedUserId(req);

  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Authentication required to generate daily plan." },
      { status: 401, headers: { "x-correlation-id": correlationId } }
    );
  }

  const { searchParams } = new URL(req.url);
  const minutes = Number(searchParams.get("minutes")) || 45;
  const energy = (searchParams.get("energy") as EnergyLevel) || "medium";
  const preferredTask = (searchParams.get("taskType") as PreferredTaskType) || "practical_coding";
  const role = searchParams.get("role") || "Frontend Developer";

  try {
    const [evidence, apps] = await Promise.all([
      getUserEvidenceWalletAsync(userId),
      getUserApplications(userId),
    ]);

    const verifiedSkills = evidence
      .filter((e) => e.status === "CONFIRMED")
      .map((e) => e.skillName);

    const defaultSkills = ["TypeScript", "React", "Next.js", "Docker", "PostgreSQL", "Testing"];
    const pendingSkills = defaultSkills.filter(
      (s) => !verifiedSkills.some((v) => v.toLowerCase() === s.toLowerCase())
    );

    const topSkillGap = pendingSkills[0] || undefined;
    const hasUpcomingInterview = (apps || []).some(
      (a: any) => a.status === "INTERVIEW" || (Array.isArray(a.interviews) && a.interviews.length > 0)
    );

    const plan = generateDailyPlan({
      availableMinutes: minutes,
      energyLevel: energy,
      preferredTaskType: preferredTask,
      topSkillGap,
      hasUpcomingInterview,
      activeApplicationCount: (apps || []).length,
    });

    const recovery = generateRecoveryPlan({
      roleTitle: role,
      verifiedSkills,
      pendingSkills,
    });

    return NextResponse.json(
      {
        success: true,
        userId,
        plan,
        recovery,
      },
      { status: 200, headers: { "x-correlation-id": correlationId } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: err?.message || "Failed to generate daily plan." },
      { status: 500, headers: { "x-correlation-id": correlationId } }
    );
  }
}
