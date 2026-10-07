/**
 * app/api/career/weekly-review/route.ts
 *
 * UBIX Weekly Career Review Endpoint
 *
 * Compiles a factual 7-day review using verified evidence, tracked applications,
 * and practice milestones. Never generates fictional accomplishments.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/supabase/auth";
import { getUserEvidenceWalletAsync } from "@/lib/career/evidenceWallet";
import { compileWeeklyCareerReview } from "@/lib/career/weeklyReview";
import { getUserApplications } from "@/lib/db";
import { getOrGenerateCorrelationId } from "@/lib/observability/correlation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const correlationId = getOrGenerateCorrelationId(req.headers);
  const userId = await getAuthenticatedUserId(req);

  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Authentication required." },
      { status: 401, headers: { "x-correlation-id": correlationId } }
    );
  }

  try {
    const [evidenceItems, rawApps] = await Promise.all([
      getUserEvidenceWalletAsync(userId),
      getUserApplications(userId),
    ]);

    const applications = (rawApps || []).map((a: any) => ({
      applicationId: a.id,
      userId,
      jobId: a.jobId || a.id,
      jobTitle: a.jobTitle || a.role || "Role",
      company: a.company || "Company",
      sourceProvider: (a.provider as any) || "generic_direct",
      mappedFields: [],
      validation: { isValid: true, missingRequiredFields: [], unnecessaryFieldsPruned: [], warnings: [] },
      status: (a.status as any) || "SUBMITTED",
      submittedAt: a.appliedDate || a.createdAt,
      providerSubmissionConfirmationId: a.submissionConfirmationId,
      createdAt: a.appliedDate || new Date().toISOString(),
      updatedAt: a.updatedAt || new Date().toISOString(),
    }));

    const confirmedSkillIds = new Set(
      evidenceItems.filter((e) => e.status === "CONFIRMED").map((e) => e.skillId)
    );
    const defaultTrackSkills = ["typescript", "react", "nextjs", "docker", "postgresql", "testing"];
    const activeSkillGaps = defaultTrackSkills.filter((s) => !confirmedSkillIds.has(s));

    const report = compileWeeklyCareerReview({
      userId,
      evidenceItems,
      applications,
      interviewAttempts: [],
      activeSkillGaps,
    });

    const hasAnyActivity =
      report.confirmedFacts.skillsGained.length > 0 ||
      report.confirmedFacts.applicationsSubmitted.length > 0 ||
      report.confirmedFacts.practiceSessionsCompleted > 0 ||
      report.confirmedFacts.interviewsCompleted > 0;

    return NextResponse.json(
      {
        success: true,
        userId,
        report,
        hasActivity: hasAnyActivity,
      },
      { status: 200, headers: { "x-correlation-id": correlationId } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: err?.message || "Failed to compile weekly review." },
      { status: 500, headers: { "x-correlation-id": correlationId } }
    );
  }
}
