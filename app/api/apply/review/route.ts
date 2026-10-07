/**
 * app/api/apply/review/route.ts
 *
 * UBIX Apply Review-First API
 *
 * Prepares an application draft by mapping profile fields to target ATS schema,
 * pruning unrequested data for privacy minimization, and preparing a confirmation token.
 * NEVER submits automatically.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { prepareApplicationDraft, requestUserConfirmation } from "@/lib/apply/ubixApply";
import { CandidateApplyProfile } from "@/lib/apply/schemas";
import { getUserResumes } from "@/lib/db";
import { getOrGenerateCorrelationId } from "@/lib/observability/correlation";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const correlationId = getOrGenerateCorrelationId(req.headers);
  const user = await getAuthenticatedUser(req);

  if (!user || !user.id) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Authentication required to prepare application." },
      { status: 401, headers: { "x-correlation-id": correlationId } }
    );
  }

  try {
    const body = await req.json();
    const { jobId, jobTitle, company, sourceProvider, candidateProfile: clientProfile } = body;

    if (!jobId || !jobTitle || !company) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "jobId, jobTitle, and company are required." },
        { status: 400, headers: { "x-correlation-id": correlationId } }
      );
    }

    // Server-authoritative candidate profile derivation
    const userResumes = await getUserResumes(user.id);
    const latestResume = userResumes && userResumes.length > 0 ? userResumes[0] : null;

    const profile: CandidateApplyProfile = {
      userId: user.id,
      fullName: clientProfile?.fullName || user.name || "Candidate",
      email: user.email,
      phone: clientProfile?.phone || undefined,
      locationCity: clientProfile?.locationCity || "Remote",
      locationCountry: clientProfile?.country || clientProfile?.locationCountry || "Remote",
      linkedInUrl: clientProfile?.linkedInUrl || undefined,
      githubUrl: clientProfile?.githubUrl || undefined,
      portfolioUrl: clientProfile?.portfolioUrl || undefined,
      resumeBulletPoints: latestResume ? [latestResume.target_role || latestResume.filename || "Professional Experience"] : [],
      confirmedSkills: [],
      workAuthorizationStatus: clientProfile?.requiresVisaSponsorship ? "REQUIRES_SPONSORSHIP" : "CITIZEN",
      disabilityAccommodationNotes: clientProfile?.accessibilityAccommodations || undefined,
    };

    const draft = prepareApplicationDraft({
      userId: user.id,
      jobId: String(jobId),
      jobTitle: String(jobTitle),
      company: String(company),
      sourceProvider: sourceProvider || "generic_direct",
      candidateProfile: profile,
    });

    // If valid, generate a server-side single-use confirmation token
    let confirmedDraft = draft;
    if (draft.validation.isValid) {
      confirmedDraft = requestUserConfirmation(draft);
    }

    return NextResponse.json(
      {
        success: true,
        draft: confirmedDraft,
      },
      { status: 200, headers: { "x-correlation-id": correlationId } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: err?.message || "Failed to prepare application draft." },
      { status: 500, headers: { "x-correlation-id": correlationId } }
    );
  }
}
