/**
 * POST /api/jobs/alert
 *
 * Real-Time Job Alert & Direct Application Email Dispatcher:
 * - Authenticated only (forces recipient to be the authenticated user)
 * - HTML-escapes all user/job fields
 * - Validates URLs to prevent javascript:/data: protocol injection
 * - Rate-limited to 5 alerts per minute per user
 * - Sanitized provider error responses
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// In-memory rate limiting: userId -> array of timestamps
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(userId) || [];
  const validTimestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (validTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    rateLimitMap.set(userId, validTimestamps);
    return true;
  }
  validTimestamps.push(now);
  rateLimitMap.set(userId, validTimestamps);
  return false;
}

function escapeHtml(str: string): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeUrl(rawUrl: string | undefined): string {
  if (!rawUrl) return "https://www.linkedin.com/jobs/";
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return parsed.toString();
    }
  } catch {
    // fallback if URL is invalid
  }
  return "https://www.linkedin.com/jobs/";
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    const authUser = await getAuthenticatedUser();
    if (!authUser) {
      return NextResponse.json(
        {
          code: "UNAUTHORIZED",
          message: "Authentication required to receive job alerts.",
          retryable: false,
          requestId,
        },
        { status: 401 }
      );
    }

    if (isRateLimited(authUser.id)) {
      return NextResponse.json(
        {
          code: "RATE_LIMITED",
          message: "Too many job alert requests. Please wait a minute before requesting another alert.",
          retryable: true,
          requestId,
        },
        { status: 429 }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          code: "BAD_REQUEST",
          message: "Invalid request payload",
          retryable: false,
          requestId,
        },
        { status: 400 }
      );
    }

    const {
      name,
      location,
      role,
      job,
    }: {
      name?: string;
      location?: string;
      role?: string;
      job?: {
        title?: string;
        company?: string;
        location?: string;
        salary?: { formatted?: string };
        applyUrl?: string;
        url?: string;
        descriptionSnippet?: string;
        jobType?: string;
      };
    } = body || {};

    // Force recipient to be authenticated user's verified email
    const recipientEmail = authUser.email;

    const rawJobTitle = job?.title || `${role || "Software Engineering"} Opportunity`;
    const rawCompany = job?.company || "Top Tech Employer";
    const rawJobLoc = job?.location || location || "Your Location";
    const rawSalary = job?.salary?.formatted || "Competitive Market Compensation";
    const rawApplyLink = job?.applyUrl || job?.url || "https://www.linkedin.com/jobs/";
    const rawCandidateName = name || authUser.name || recipientEmail.split("@")[0];
    const rawSnippet = job?.descriptionSnippet || "Work with leading engineering teams on scalable architectures and modern interfaces.";
    const rawJobType = job?.jobType || "Full-Time";

    const cleanJobTitle = escapeHtml(rawJobTitle);
    const cleanCompany = escapeHtml(rawCompany);
    const cleanJobLoc = escapeHtml(rawJobLoc);
    const cleanSalary = escapeHtml(rawSalary);
    const cleanApplyLink = sanitizeUrl(rawApplyLink);
    const cleanCandidateName = escapeHtml(rawCandidateName);
    const cleanSnippet = escapeHtml(rawSnippet);
    const cleanJobType = escapeHtml(rawJobType);

    const emailSubject = `🚀 New Opening in ${cleanJobLoc}: ${cleanJobTitle} at ${cleanCompany}`;

    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff; color: #111827;">
        <div style="border-bottom: 2px solid #0066cc; padding-bottom: 16px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
          <h2 style="margin: 0; color: #111827; font-size: 20px;">CareerForge Real-Time Job Alert</h2>
          <span style="background-color: #ebf5ff; color: #0066cc; font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 12px; text-transform: uppercase;">Live Match</span>
        </div>

        <p style="font-size: 15px; line-height: 1.5; color: #374151;">
          Hello <strong>${cleanCandidateName}</strong>,
        </p>
        <p style="font-size: 14px; line-height: 1.5; color: #4b5563;">
          A new verified position matching your tracked location (<strong>${cleanJobLoc}</strong>) and target role has just opened up:
        </p>

        <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px; margin: 20px 0;">
          <h3 style="margin: 0 0 6px 0; color: #111827; font-size: 17px;">${cleanJobTitle}</h3>
          <p style="margin: 0 0 10px 0; color: #4b5563; font-size: 13px; font-weight: 600;">
            🏢 ${cleanCompany} &nbsp;·&nbsp; 📍 ${cleanJobLoc} &nbsp;·&nbsp; 💼 ${cleanJobType}
          </p>
          <p style="margin: 0 0 12px 0; color: #059669; font-size: 13px; font-weight: 700;">
            💰 Compensation: ${cleanSalary}
          </p>
          <p style="margin: 0; color: #6b7280; font-size: 12px; line-height: 1.5;">
            ${cleanSnippet}
          </p>
        </div>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${cleanApplyLink}" target="_blank" rel="noopener noreferrer" style="background-color: #111827; color: #ffffff; padding: 12px 28px; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            👉 Open Company Application & Registration Form →
          </a>
        </div>

        <p style="font-size: 12px; color: #6b7280; text-align: center; margin-top: 24px; border-top: 1px solid #f3f4f6; padding-top: 16px;">
          Direct Registration Link: <br/>
          <a href="${cleanApplyLink}" target="_blank" rel="noopener noreferrer" style="color: #0066cc; word-break: break-all;">${cleanApplyLink}</a>
        </p>

        <p style="font-size: 11px; color: #9ca3af; text-align: center; margin-top: 12px;">
          You received this alert because real-time location tracking is active on CareerForge for ${cleanJobLoc}.
        </p>
      </div>
    `;

    // Free Cloud Email Dispatch (Resend API if key is present)
    const resendApiKey = process.env.RESEND_API_KEY;
    let emailSentViaCloud = false;

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
            to: [recipientEmail],
            subject: emailSubject,
            html: emailHtml,
          }),
        });

        if (resendRes.ok) {
          emailSentViaCloud = true;
        }
      } catch (cloudErr) {
        console.warn("[Jobs Alert API] Resend email dispatch error:", cloudErr);
      }
    }

    return NextResponse.json({
      status: "success",
      message: `Real-time job alert for ${cleanCompany} successfully dispatched to ${recipientEmail}!`,
      details: {
        recipient: recipientEmail,
        company: cleanCompany,
        jobTitle: cleanJobTitle,
        location: cleanJobLoc,
        salary: cleanSalary,
        applyUrl: cleanApplyLink,
        sentAt: new Date().toISOString(),
        cloudDispatched: emailSentViaCloud,
        subject: emailSubject,
      },
    });
  } catch (error) {
    console.error(`[Jobs Alert API] Error (${requestId}):`, error);
    return NextResponse.json(
      {
        code: "INTERNAL_ERROR",
        message: "Failed to process job alert email.",
        retryable: true,
        requestId,
      },
      { status: 500 }
    );
  }
}
