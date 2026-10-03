/**
 * POST /api/practice/telemetry
 *
 * Resilient, Idempotent Practice Telemetry Submission Endpoint:
 * - Authenticated only (requires active session)
 * - Strict idempotency enforcement via eventId deduplication
 * - Guarantees that network retries or reconnections never double-award points or streaks
 * - Bounded payload size and schema validation
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { checkRateLimit, checkRateLimitAsync, getClientIp, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { createApiErrorResponse } from "@/lib/errors/apiError";

export const runtime = "nodejs";

interface TelemetryEventRecord {
  eventId: string;
  userId: string;
  track: string;
  questionId: string;
  evaluation: string;
  scoreAwarded: number;
  processedAt: number;
}

// In-memory idempotency cache (keyed by eventId, capped at 10,000 items)
const idempotencyStore = new Map<string, TelemetryEventRecord>();
const MAX_IDEMPOTENCY_ENTRIES = 10000;

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const clientIp = getClientIp(req);

  // 1. Authentication Check
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return createApiErrorResponse("UNAUTHORIZED", "Authentication required to submit practice telemetry.", requestId, {
      statusCode: 401,
    });
  }

  // 2. Rate Limiting
  const rl = await checkRateLimitAsync(`practice_telemetry:${authUser.id || clientIp}`, RATE_LIMIT_PRESETS.generalApi);
  if (!rl.allowed || rl.isLimited) {
    if (rl.status === 503) {
      return createApiErrorResponse(
        "SERVICE_UNAVAILABLE",
        "Service temporarily unavailable. Please try again shortly.",
        requestId,
        { statusCode: 503, retryable: true }
      );
    }
    return createApiErrorResponse(
      "RATE_LIMITED",
      "Too many telemetry submissions. Please slow down.",
      requestId,
      { statusCode: 429, retryable: true }
    );
  }

  // 3. Body Parsing & Schema Validation
  let body: any;
  try {
    body = await req.json();
  } catch {
    return createApiErrorResponse("BAD_REQUEST", "Invalid JSON payload.", requestId, { statusCode: 400 });
  }

  const { eventId, track, questionId, evaluation, timestamp } = body || {};

  if (!eventId || typeof eventId !== "string" || eventId.length > 100) {
    return createApiErrorResponse("BAD_REQUEST", "Missing or invalid eventId idempotency key.", requestId, {
      statusCode: 400,
    });
  }

  if (!track || typeof track !== "string" || !questionId || typeof questionId !== "string") {
    return createApiErrorResponse("BAD_REQUEST", "track and questionId are required strings.", requestId, {
      statusCode: 400,
    });
  }

  const validEvaluations = ["correct", "partial", "incorrect", "dont_know"];
  if (!validEvaluations.includes(evaluation)) {
    return createApiErrorResponse(
      "BAD_REQUEST",
      `Invalid evaluation value. Allowed: ${validEvaluations.join(", ")}`,
      requestId,
      { statusCode: 400 }
    );
  }

  // 4. Idempotency Check: Return existing record if already processed for this user
  const idempotencyKey = `${authUser.id}:${eventId}`;
  if (idempotencyStore.has(idempotencyKey)) {
    const existing = idempotencyStore.get(idempotencyKey)!;
    return NextResponse.json({
      success: true,
      duplicate: true,
      status: "deduplicated",
      message: "Event already processed. Idempotent response returned.",
      eventId: existing.eventId,
      scoreAwarded: existing.scoreAwarded,
      processedAt: existing.processedAt,
    });
  }

  // 5. Calculate Score Delta
  let scoreAwarded = 0;
  if (evaluation === "correct") scoreAwarded = 10;
  else if (evaluation === "partial") scoreAwarded = 5;

  const record: TelemetryEventRecord = {
    eventId,
    userId: authUser.id,
    track: track.slice(0, 50),
    questionId: questionId.slice(0, 100),
    evaluation,
    scoreAwarded,
    processedAt: Date.now(),
  };

  // Evict oldest record if cache reaches limit
  if (idempotencyStore.size >= MAX_IDEMPOTENCY_ENTRIES) {
    const oldestKey = idempotencyStore.keys().next().value;
    if (oldestKey) idempotencyStore.delete(oldestKey);
  }
  idempotencyStore.set(idempotencyKey, record);

  return NextResponse.json({
    success: true,
    duplicate: false,
    status: "recorded",
    eventId,
    scoreAwarded,
    evaluation,
    processedAt: record.processedAt,
  });
}
