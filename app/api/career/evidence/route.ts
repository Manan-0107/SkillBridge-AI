/**
 * app/api/career/evidence/route.ts
 *
 * Authenticated endpoints to manage the Skill Evidence Wallet.
 * Provides verifiable evidence management with provenance tracking.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/supabase/auth";
import {
  getUserEvidenceWalletAsync,
  recordSkillEvidenceAsync,
  getVerifiedSkillsForUser,
  type EvidenceSourceType,
  type EvidenceStatus,
} from "@/lib/career/evidenceWallet";
import { getOrGenerateCorrelationId } from "@/lib/observability/correlation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const correlationId = getOrGenerateCorrelationId(req.headers);
  const userId = await getAuthenticatedUserId(req);

  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Authentication required to view Evidence Wallet." },
      { status: 401, headers: { "x-correlation-id": correlationId } }
    );
  }

  const evidence = await getUserEvidenceWalletAsync(userId);
  const verifiedSkills = getVerifiedSkillsForUser(userId);

  return NextResponse.json(
    {
      success: true,
      userId,
      evidence,
      verifiedSkills,
      count: evidence.length,
      timestamp: new Date().toISOString(),
    },
    { status: 200, headers: { "x-correlation-id": correlationId } }
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const correlationId = getOrGenerateCorrelationId(req.headers);
  const userId = await getAuthenticatedUserId(req);

  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Authentication required to record skill evidence." },
      { status: 401, headers: { "x-correlation-id": correlationId } }
    );
  }

  try {
    const body = await req.json();
    const { skillName, source, status, confidence, title, description, artifactUrl } = body;

    if (!skillName || !title) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Missing required fields: skillName and title are required." },
        { status: 400, headers: { "x-correlation-id": correlationId } }
      );
    }

    const item = await recordSkillEvidenceAsync({
      userId,
      skillName: String(skillName).trim(),
      source: (source as EvidenceSourceType) || "USER_CONFIRMATION",
      status: (status as EvidenceStatus) || "CONFIRMED",
      confidence: typeof confidence === "number" ? Math.max(0, Math.min(1, confidence)) : 0.85,
      title: String(title).trim(),
      description: description ? String(description).trim() : "",
      artifactUrl: artifactUrl ? String(artifactUrl).trim() : undefined,
    });

    return NextResponse.json(
      { success: true, item },
      { status: 201, headers: { "x-correlation-id": correlationId } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: err?.message || "Failed to record skill evidence." },
      { status: 500, headers: { "x-correlation-id": correlationId } }
    );
  }
}
