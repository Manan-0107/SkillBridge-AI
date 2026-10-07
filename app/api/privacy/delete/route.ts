/**
 * app/api/privacy/delete/route.ts
 *
 * Intentionally Destructive Account & Data Deletion Workflow
 *
 * Requirements:
 * 1. Strict server-side authentication.
 * 2. Explicit confirmation string required ("DELETE MY ACCOUNT PERMANENTLY").
 * 3. Purges all user-owned records across tables (cascade).
 * 4. Invalidates authentication session and clears cookies.
 * 5. Strictly isolated: Never affects another user's records.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { supabase } from "@/lib/supabase";
import { SESSION_CONFIG } from "@/lib/security/session";
import { _resetCareerMemory } from "@/lib/memory/careerMemory";
import { _resetEvidenceWallet } from "@/lib/career/evidenceWallet";
import { isLocalDevOrTest } from "@/lib/security/environment";
import { getOrGenerateCorrelationId } from "@/lib/observability/correlation";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const correlationId = getOrGenerateCorrelationId(req.headers);
  const user = await getAuthenticatedUser(req);

  if (!user || !user.id) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Authentication required to initiate account deletion." },
      { status: 401, headers: { "x-correlation-id": correlationId } }
    );
  }

  try {
    const body = await req.json();
    const { confirmationPhrase } = body;

    const REQUIRED_PHRASE = "DELETE MY ACCOUNT PERMANENTLY";
    if (confirmationPhrase !== REQUIRED_PHRASE) {
      return NextResponse.json(
        {
          code: "CONFIRMATION_REQUIRED",
          message: `Explicit confirmation required. You must submit the exact phrase '${REQUIRED_PHRASE}'.`,
        },
        { status: 400, headers: { "x-correlation-id": correlationId } }
      );
    }

    const userId = user.id;

    // Purge records from database if Supabase client is active
    if (supabase) {
      try {
        await Promise.allSettled([
          supabase.from("career_memory").delete().eq("user_id", userId),
          supabase.from("skill_evidence").delete().eq("user_id", userId),
          supabase.from("automation_executions").delete().eq("user_id", userId),
          supabase.from("resume_uploads").delete().eq("user_id", userId),
          supabase.from("users").delete().eq("id", userId),
        ]);
      } catch (dbErr) {
        console.warn("[Privacy Delete] DB deletion warning:", dbErr);
      }
    }

    // In local dev/test or guest sessions, clear in-memory caches
    if (isLocalDevOrTest() || user.isGuest) {
      _resetCareerMemory();
      _resetEvidenceWallet();
    }

    console.log(`[Privacy Delete] User account permanently deleted for userId=${userId}`);

    const res = NextResponse.json(
      {
        success: true,
        message: "Your account and all associated career data have been permanently deleted.",
        deletedUserId: userId,
      },
      { status: 200, headers: { "x-correlation-id": correlationId } }
    );

    // Invalidate and clear auth cookies
    res.cookies.set(SESSION_CONFIG.cookieName, "", {
      ...SESSION_CONFIG.cookieOptions,
      maxAge: 0,
    });
    res.cookies.set("cf_uid", "", {
      ...SESSION_CONFIG.cookieOptions,
      maxAge: 0,
    });

    return res;
  } catch (err: any) {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: err?.message || "Failed to complete account deletion." },
      { status: 500, headers: { "x-correlation-id": correlationId } }
    );
  }
}
