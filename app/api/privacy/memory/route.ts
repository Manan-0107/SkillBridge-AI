/**
 * app/api/privacy/memory/route.ts
 *
 * Authenticated endpoints to view and record personal Career Memory items.
 * Enforces strict tenant isolation: only the authenticated user's records can be accessed.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/supabase/auth";
import {
  getUserCareerMemoryAsync,
  recordMemoryItemAsync,
  type MemoryCategory,
  type MemoryProvenance,
} from "@/lib/memory/careerMemory";
import { getOrGenerateCorrelationId } from "@/lib/observability/correlation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const correlationId = getOrGenerateCorrelationId(req.headers);
  const userId = await getAuthenticatedUserId(req);

  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Authentication required to access Career Memory." },
      { status: 401, headers: { "x-correlation-id": correlationId } }
    );
  }

  const memory = await getUserCareerMemoryAsync(userId);

  return NextResponse.json(
    {
      success: true,
      userId,
      memory,
      count: memory.length,
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
      { code: "UNAUTHORIZED", message: "Authentication required to record Career Memory." },
      { status: 401, headers: { "x-correlation-id": correlationId } }
    );
  }

  try {
    const body = await req.json();
    const { category, key, value, provenance, confidence, sourceDescription } = body;

    if (!category || !key || !value) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Missing required fields: category, key, and value are mandatory." },
        { status: 400, headers: { "x-correlation-id": correlationId } }
      );
    }

    const item = await recordMemoryItemAsync({
      userId,
      category: category as MemoryCategory,
      key: String(key).trim(),
      value: String(value).trim(),
      provenance: (provenance as MemoryProvenance) || "INFERRED",
      confidence: typeof confidence === "number" ? Math.max(0, Math.min(1, confidence)) : 0.8,
      sourceDescription: sourceDescription ? String(sourceDescription) : "User added via Privacy Center",
    });

    return NextResponse.json(
      { success: true, item },
      { status: 201, headers: { "x-correlation-id": correlationId } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: err?.message || "Failed to record memory item." },
      { status: 500, headers: { "x-correlation-id": correlationId } }
    );
  }
}
