/**
 * GET /api/assistant/status
 *
 * Provider Health & Readiness Status Endpoint.
 * Strictly verifies provider readiness WITHOUT leaking secrets, keys, or tokens.
 */

import { NextResponse } from "next/server";
import { getProviderStatus } from "@/lib/ai/providerConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status = getProviderStatus();
  return NextResponse.json({
    ok: true,
    provider: status.provider,
    configured: status.configured,
    status: status.status,
    model: status.model,
  });
}
