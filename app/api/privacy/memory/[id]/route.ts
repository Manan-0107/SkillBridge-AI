/**
 * app/api/privacy/memory/[id]/route.ts
 *
 * Authenticated endpoints to confirm, reject, or delete individual Career Memory items.
 * Strictly verifies item ownership: users can only mutate their own records.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/supabase/auth";
import {
  confirmMemoryItemAsync,
  rejectMemoryItemAsync,
  deleteMemoryItemAsync,
  getUserCareerMemoryAsync,
} from "@/lib/memory/careerMemory";
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

  const itemId = params.id;
  if (!itemId) {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "Memory item ID is required." },
      { status: 400, headers: { "x-correlation-id": correlationId } }
    );
  }

  try {
    const body = await req.json();
    const { action, reason } = body;

    // Verify ownership before mutating
    const userMemory = await getUserCareerMemoryAsync(userId);
    const existing = userMemory.find((m) => m.id === itemId);
    if (!existing) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Memory item not found or does not belong to you." },
        { status: 404, headers: { "x-correlation-id": correlationId } }
      );
    }

    if (action === "confirm") {
      const updated = await confirmMemoryItemAsync(userId, itemId);
      return NextResponse.json(
        { success: true, item: updated },
        { status: 200, headers: { "x-correlation-id": correlationId } }
      );
    } else if (action === "reject") {
      const updated = await rejectMemoryItemAsync(userId, itemId, reason);
      return NextResponse.json(
        { success: true, item: updated },
        { status: 200, headers: { "x-correlation-id": correlationId } }
      );
    } else {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid action. Supported actions: 'confirm' or 'reject'." },
        { status: 400, headers: { "x-correlation-id": correlationId } }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: err?.message || "Failed to update memory item." },
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

  const itemId = params.id;
  if (!itemId) {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "Memory item ID is required." },
      { status: 400, headers: { "x-correlation-id": correlationId } }
    );
  }

  try {
    // Verify ownership
    const userMemory = await getUserCareerMemoryAsync(userId);
    const existing = userMemory.find((m) => m.id === itemId);
    if (!existing) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Memory item not found or does not belong to you." },
        { status: 404, headers: { "x-correlation-id": correlationId } }
      );
    }

    await deleteMemoryItemAsync(userId, itemId);

    return NextResponse.json(
      { success: true, deletedId: itemId },
      { status: 200, headers: { "x-correlation-id": correlationId } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: err?.message || "Failed to delete memory item." },
      { status: 500, headers: { "x-correlation-id": correlationId } }
    );
  }
}
