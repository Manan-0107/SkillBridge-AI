/**
 * app/api/health/liveness/route.ts
 *
 * Operational Liveness Probe for UBIX.
 * Confirms the Next.js application process is running and responding to HTTP requests.
 *
 * Invariant: Never discloses secrets, internal tokens, or configuration.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      status: "ok",
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    }
  );
}
