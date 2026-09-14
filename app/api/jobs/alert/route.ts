/**
 * POST /api/jobs/alert
 *
 * Sends the authenticated user a job-alert email for a posting they're viewing.
 *
 * Audit finding C2 — this route was an unauthenticated open email relay with
 * HTML injection. Now:
 *   - requires a verified session (401 otherwise)
 *   - the recipient is ALWAYS the session user's own email; the body cannot
 *     name a recipient
 *   - every interpolated value is HTML-escaped in `renderJobAlertEmail`
 *   - a per-user token bucket caps dispatch spam (429)
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { SESSION_COOKIE_NAME, verifySessionCookie } from "@/lib/session";
import { takeToken } from "@/lib/rateLimit";
import { renderJobAlertEmail, type JobAlertJob } from "@/lib/emails/jobAlert";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Verified session email: a live Supabase session, or a `cf_uid` cookie we signed after one.
 *  (Mirrors `resolveEmail()` in app/api/user/route.ts — the app's session-identity check.) */
async function sessionEmail(): Promise<string | null> {
  const live = await getAuthenticatedUser();
  if (live?.email) return live.email;
  return verifySessionCookie(cookies().get(SESSION_COOKIE_NAME)?.value)?.email ?? null;
}

/** 3 alerts, then ~1 every 60s. */
const ALERT_RULE = { capacity: 3, refillPerSec: 1 / 60 };

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticated session required.
    const email = await sessionEmail();
    if (!email) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // 2. Per-user dispatch rate limit.
    const gate = takeToken(`jobs-alert:${email}`, ALERT_RULE);
    if (!gate.ok) {
      return NextResponse.json(
        { error: "Too many alert requests. Please wait before requesting another." },
        { status: 429, headers: { "Retry-After": String(gate.retryAfterSec) } }
      );
    }

    // 3. Body supplies only the job context — never the recipient.
    let body: { name?: string; role?: string; location?: string; job?: JobAlertJob };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { subject, html } = renderJobAlertEmail({
      recipientName: typeof body.name === "string" ? body.name : email.split("@")[0],
      role: typeof body.role === "string" ? body.role : undefined,
      location: typeof body.location === "string" ? body.location : undefined,
      job: body.job,
    });

    // 4. Dispatch to the SESSION user's address only.
    const resendApiKey = process.env.RESEND_API_KEY;
    let dispatched = false;
    if (resendApiKey) {
      try {
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "CareerForge Alerts <onboarding@resend.dev>",
            to: [email], // ← hardcoded to the authenticated user
            subject,
            html,
          }),
          signal: AbortSignal.timeout(8000),
        });
        dispatched = resendRes.ok;
        if (!resendRes.ok) {
          console.warn("[Jobs Alert API] Resend responded", resendRes.status);
        }
      } catch (cloudErr) {
        console.warn("[Jobs Alert API] Resend email error:", cloudErr);
      }
    }

    return NextResponse.json({
      status: dispatched ? "sent" : "queued",
      dispatched,
      recipient: email,
      subject,
    });
  } catch (error) {
    console.error("[Jobs Alert API] Error:", error);
    return NextResponse.json({ error: "Failed to process job alert." }, { status: 500 });
  }
}
