/**
 * app/api/apply/confirm/route.ts
 *
 * UBIX Apply Final Confirmation & Submission API
 *
 * Requires single-use cryptographic user confirmation token.
 * Strictly verifies user identity server-side before submitting to site adapter.
 * Persists submission record to tracked applications.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/supabase/auth";
import { submitConfirmedApplication } from "@/lib/apply/ubixApply";
import { ApplicationDraft } from "@/lib/apply/schemas";
import { saveUserApplication } from "@/lib/db";
import { getOrGenerateCorrelationId } from "@/lib/observability/correlation";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const correlationId = getOrGenerateCorrelationId(req.headers);
  const userId = await getAuthenticatedUserId(req);

  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Authentication required to submit application." },
      { status: 401, headers: { "x-correlation-id": correlationId } }
    );
  }

  try {
    const body = await req.json();
    const { draft, confirmationToken } = body as {
      draft: ApplicationDraft;
      confirmationToken: string;
    };

    if (!draft || !confirmationToken) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Both draft and confirmationToken are required." },
        { status: 400, headers: { "x-correlation-id": correlationId } }
      );
    }

    // Verify tenant isolation: draft must belong to the authenticated user
    if (draft.userId !== userId) {
      return NextResponse.json(
        { code: "FORBIDDEN", message: "Application draft belongs to another user." },
        { status: 403, headers: { "x-correlation-id": correlationId } }
      );
    }

    // Verify token matches server-issued token
    if (draft.userConfirmationToken !== confirmationToken) {
      return NextResponse.json(
        { code: "INVALID_CONFIRMATION_TOKEN", message: "Invalid or expired confirmation token." },
        { status: 400, headers: { "x-correlation-id": correlationId } }
      );
    }

    const { draft: submittedDraft, result } = await submitConfirmedApplication(
      draft,
      confirmationToken
    );

    // Save tracked application to user's database records
    const trackedApp = {
      id: submittedDraft.applicationId,
      userId,
      company: submittedDraft.company,
      role: submittedDraft.jobTitle,
      jobTitle: submittedDraft.jobTitle,
      status: "SUBMITTED",
      appliedDate: new Date().toISOString(),
      provider: submittedDraft.sourceProvider,
      submissionConfirmationId: result.providerConfirmationId || result.receiptTimestamp,
      receiptTimestamp: result.receiptTimestamp,
      fieldsSubmitted: submittedDraft.mappedFields.map((f) => f.externalFieldLabel),
      fieldsExcluded: submittedDraft.validation.unnecessaryFieldsPruned,
    };

    await saveUserApplication(userId, trackedApp);

    return NextResponse.json(
      {
        success: true,
        draft: submittedDraft,
        result,
      },
      { status: 200, headers: { "x-correlation-id": correlationId } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { code: "SUBMISSION_FAILED", message: err?.message || "Application submission failed." },
      { status: 500, headers: { "x-correlation-id": correlationId } }
    );
  }
}
