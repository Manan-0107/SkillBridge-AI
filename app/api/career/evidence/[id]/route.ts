/**
 * app/api/career/evidence/[id]/route.ts
 *
 * Authenticated endpoints to confirm, reject, or delete specific skill evidence items.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/supabase/auth";
import {
  confirmEvidenceAsync,
  rejectEvidenceAsync,
  deleteSkillEvidenceAsync,
  getUserEvidenceWalletAsync,
} from "@/lib/career/evidenceWallet";
import { getOrGenerateCorrelationId } from "@/lib/observability/correlation";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const correlationId = getOrGenerateCorrelationId(req.headers);
  const userId = await getAuthenticatedUserId(req);

  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Authentication required." },
      { status: 401, headers: { "x-correlation-id": correlationId } }
    );
  }

  const evidenceId = params.id;
  if (!evidenceId) {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "Evidence ID is required." },
      { status: 400, headers: { "x-correlation-id": correlationId } }
    );
  }

  try {
    const body = await req.json();
    const { action, reason } = body;

    // Verify ownership
    const evidence = await getUserEvidenceWalletAsync(userId);
    const existing = evidence.find((e) => e.id === evidenceId);
    if (!existing) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Evidence item not found or does not belong to you." },
        { status: 404, headers: { "x-correlation-id": correlationId } }
      );
    }

    if (action === "confirm") {
      const updated = await confirmEvidenceAsync(userId, evidenceId);
      return NextResponse.json(
        { success: true, item: updated },
        { status: 200, headers: { "x-correlation-id": correlationId } }
      );
    } else if (action === "reject") {
      const updated = await rejectEvidenceAsync(userId, evidenceId, reason);
      return NextResponse.json(
        { success: true, item: updated },
        { status: 200, headers: { "x-correlation-id": correlationId } }
      );
    } else {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid action. Supported: 'confirm' or 'reject'." },
        { status: 400, headers: { "x-correlation-id": correlationId } }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: err?.message || "Failed to update evidence item." },
      { status: 500, headers: { "x-correlation-id": correlationId } }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const correlationId = getOrGenerateCorrelationId(req.headers);
  const userId = await getAuthenticatedUserId(req);

  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Authentication required." },
      { status: 401, headers: { "x-correlation-id": correlationId } }
    );
  }

  const evidenceId = params.id;
  if (!evidenceId) {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "Evidence ID is required." },
      { status: 400, headers: { "x-correlation-id": correlationId } }
    );
  }

  try {
    // Verify ownership
    const evidence = await getUserEvidenceWalletAsync(userId);
    const existing = evidence.find((e) => e.id === evidenceId);
    if (!existing) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Evidence item not found or does not belong to you." },
        { status: 404, headers: { "x-correlation-id": correlationId } }
      );
    }

    await deleteSkillEvidenceAsync(userId, evidenceId);

    return NextResponse.json(
      { success: true, deletedId: evidenceId },
      { status: 200, headers: { "x-correlation-id": correlationId } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: err?.message || "Failed to delete evidence item." },
      { status: 500, headers: { "x-correlation-id": correlationId } }
    );
  }
}
