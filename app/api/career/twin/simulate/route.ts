/**
 * app/api/career/twin/simulate/route.ts
 *
 * UBIX Career Twin Simulation API
 *
 * Runs deterministic what-if scenario projections based on candidate's
 * verified evidence and canonical skill graph relationships.
 * Disclaims guarantees; never invents artificial outcomes.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/supabase/auth";
import { getUserEvidenceWalletAsync } from "@/lib/career/evidenceWallet";
import { simulateCareerGrowth, SimulationScenarioInput } from "@/lib/career/careerTwin";
import { getOrGenerateCorrelationId } from "@/lib/observability/correlation";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const correlationId = getOrGenerateCorrelationId(req.headers);
  const userId = await getAuthenticatedUserId(req);

  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Authentication required to run Career Twin simulation." },
      { status: 401, headers: { "x-correlation-id": correlationId } }
    );
  }

  try {
    const body = await req.json();
    const { targetSkillToAdd, hoursPerWeek, currentRole, targetRole } = body;

    if (!targetSkillToAdd) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "targetSkillToAdd is required." },
        { status: 400, headers: { "x-correlation-id": correlationId } }
      );
    }

    const input: SimulationScenarioInput = {
      targetSkillToAdd: String(targetSkillToAdd).trim(),
      hoursPerWeek: Number(hoursPerWeek) || 10,
      currentRole: currentRole || "Frontend Developer",
      targetRole: targetRole || "Full-Stack Engineer",
    };

    const userEvidence = await getUserEvidenceWalletAsync(userId);
    const simulation = simulateCareerGrowth(input, userEvidence);

    return NextResponse.json(
      {
        success: true,
        userId,
        simulation,
        disclaimer: "Scenario estimates are non-binding projections based on canonical skill graphs and current evidence. Not a guarantee of employment or compensation.",
        evidenceItemsConsidered: userEvidence.length,
      },
      { status: 200, headers: { "x-correlation-id": correlationId } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: err?.message || "Simulation failed." },
      { status: 500, headers: { "x-correlation-id": correlationId } }
    );
  }
}
