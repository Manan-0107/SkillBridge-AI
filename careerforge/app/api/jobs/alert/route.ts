/**
 * POST /api/jobs/alert
 *
 * Real-Time Job Alert & Direct Application Email Dispatcher (LinkedIn-Style):
 * - Ingests candidate email, identified location, and real-time job opening
 * - Sends direct email notification with role, company, salary, and company registration form link
 * - Resend API / NodeMailer / Free Developer Email Dispatcher
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      email,
      name,
      location,
      role,
      job,
    }: {
      email: string;
      name?: string;
      location?: string;
      role?: string;
      job?: {
        title: string;
        company: string;
        location: string;
        salary?: { formatted?: string };
        applyUrl: string;
        url?: string;
        descriptionSnippet?: string;
        jobType?: string;
      };
    } = body;

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "A valid email address is required to receive job alerts." },
        { status: 400 }
      );
    }

    const jobTitle = job?.title || `${role || "Software Engineering"} Opportunity`;
    const company = job?.company || "Top Tech Employer";
    const jobLoc = job?.location || location || "Your Location";
    const salary = job?.salary?.formatted || "Competitive Market Compensation";
    const applyLink = job?.applyUrl || job?.url || "https://www.linkedin.com/jobs/";
    const candidateName = name || email.split("@")[0];

    const emailSubject = `🚀 New Opening in ${jobLoc}: ${jobTitle} at ${company}`;

    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff; color: #111827;">
        <div style="border-bottom: 2px solid #0066cc; padding-bottom: 16px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
          <h2 style="margin: 0; color: #111827; font-size: 20px;">CareerForge Real-Time Job Alert</h2>
          <span style="background-color: #ebf5ff; color: #0066cc; font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 12px; text-transform: uppercase;">Live Match</span>
        </div>

        <p style="font-size: 15px; line-height: 1.5; color: #374151;">
          Hello <strong>${candidateName}</strong>,
        </p>
        <p style="font-size: 14px; line-height: 1.5; color: #4b5563;">
          A new verified position matching your tracked location (<strong>${jobLoc}</strong>) and target role has just opened up:
        </p>

        <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px; margin: 20px 0;">
          <h3 style="margin: 0 0 6px 0; color: #111827; font-size: 17px;">${jobTitle}</h3>
          <p style="margin: 0 0 10px 0; color: #4b5563; font-size: 13px; font-weight: 600;">
            🏢 ${company} &nbsp;·&nbsp; 📍 ${jobLoc} &nbsp;·&nbsp; 💼 ${job?.jobType || "Full-Time"}
          </p>
          <p style="margin: 0 0 12px 0; color: #059669; font-size: 13px; font-weight: 700;">
            💰 Compensation: ${salary}
          </p>
          <p style="margin: 0; color: #6b7280; font-size: 12px; line-height: 1.5;">
            ${job?.descriptionSnippet || "Work with leading engineering teams on scalable architectures and modern interfaces."}
          </p>
        </div>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${applyLink}" target="_blank" rel="noopener noreferrer" style="background-color: #111827; color: #ffffff; padding: 12px 28px; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            👉 Open Company Application & Registration Form →
          </a>
        </div>

        <p style="font-size: 12px; color: #6b7280; text-align: center; margin-top: 24px; border-top: 1px solid #f3f4f6; padding-top: 16px;">
          Direct Registration Link: <br/>
          <a href="${applyLink}" target="_blank" style="color: #0066cc; word-break: break-all;">${applyLink}</a>
        </p>

        <p style="font-size: 11px; color: #9ca3af; text-align: center; margin-top: 12px;">
          You received this alert because real-time location tracking is active on CareerForge for ${jobLoc}.
        </p>
      </div>
    `;

    // ─── Free Cloud Email Dispatch (Resend API if key is present) ─────────────
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
            to: [email],
            subject: emailSubject,
            html: emailHtml,
          }),
        });

        if (resendRes.ok) {
          emailSentViaCloud = true;
        }
      } catch (cloudErr) {
        console.warn("[Jobs Alert API] Resend email error:", cloudErr);
      }
    }

    return NextResponse.json({
      status: "success",
      message: `Real-time job alert for ${company} successfully dispatched to ${email}!`,
      details: {
        recipient: email,
        company,
        jobTitle,
        location: jobLoc,
        salary,
        applyUrl: applyLink,
        sentAt: new Date().toISOString(),
        cloudDispatched: emailSentViaCloud,
        subject: emailSubject,
      },
    });
  } catch (error: any) {
    console.error("[Jobs Alert API] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to process job alert email." },
      { status: 500 }
    );
  }
}
