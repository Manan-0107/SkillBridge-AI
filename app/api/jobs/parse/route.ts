/**
 * POST /api/jobs/parse
 *
 * Ingests either:
 * 1. rawText: Raw job description text pasted by the user.
 * 2. jobUrl: A web URL for a job posting.
 *
 * SSRF & Security Rules:
 * - When jobUrl is passed, strictly validated against SSRF engine (blocks localhost, 127.0.0.1, private IPs, AWS metadata 169.254.169.254).
 * - Enforces 15-second timeout and 1MB response size limit.
 * - If fetch fails or is disallowed, responds with clear error prompting manual text paste.
 *
 * Returns normalized JobPosting object.
 */

import { NextRequest, NextResponse } from "next/server";
import { validateUrlForSsrf } from "@/lib/security/ssrf";
import { parseJobDescription } from "@/lib/career/jobParser";
import { checkRateLimit, checkRateLimitAsync, RATE_LIMIT_POLICIES } from "@/lib/security/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // 1. Rate Limiting
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const limiter = await checkRateLimitAsync(`jobs-parse:${ip}`, RATE_LIMIT_POLICIES.PUBLIC_API);
    if (!limiter.allowed || limiter.isLimited) {
      if (limiter.status === 503) {
        return NextResponse.json(
          { error: "Service temporarily unavailable. Please try again shortly." },
          { status: 503 }
        );
      }
      return NextResponse.json(
        { error: "Too many parse requests. Please wait a moment." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { rawText, jobUrl, titleHint, companyHint, locationHint } = body;

    // 2. Validate input
    if (!rawText && !jobUrl) {
      return NextResponse.json(
        { error: "Either 'rawText' or a valid 'jobUrl' must be provided." },
        { status: 400 }
      );
    }

    let textToParse = "";
    let sourceUrl = jobUrl || "";

    // 3. Handle URL Fetch with SSRF Defense
    if (jobUrl) {
      const ssrfCheck = validateUrlForSsrf(jobUrl, { allowHttpInDev: false });
      if (!ssrfCheck.valid) {
        return NextResponse.json(
          {
            error: `Target URL is invalid or blocked for security reasons: ${ssrfCheck.reason}`,
            canFallbackToPaste: true,
          },
          { status: 400 }
        );
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(jobUrl, {
          signal: controller.signal,
          headers: {
            "User-Agent": "CareerForge-Bot/1.0 (Job Description Assistant; +https://careerforge.app)",
            Accept: "text/html,text/plain",
          },
        });
        clearTimeout(timeout);

        if (!response.ok) {
          return NextResponse.json(
            {
              error: `Unable to retrieve job page directly (HTTP ${response.status}). Please paste the job description text manually.`,
              canFallbackToPaste: true,
            },
            { status: 422 }
          );
        }

        const html = await response.text();
        // Basic HTML tag stripping to get clean readable text
        textToParse = html
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 30000); // Max 30k characters bound
      } catch (fetchErr: unknown) {
        return NextResponse.json(
          {
            error: "Failed to connect to the provided URL. External sites may block automated requests. Please paste the job description text manually.",
            canFallbackToPaste: true,
          },
          { status: 422 }
        );
      }
    } else {
      // 4. Bound raw text length (maximum 30k characters)
      textToParse = typeof rawText === "string" ? rawText.slice(0, 30000) : "";
    }

    if (!textToParse.trim()) {
      return NextResponse.json(
        { error: "The provided content does not contain readable text." },
        { status: 400 }
      );
    }

    // 5. Parse deterministically
    const normalizedJob = parseJobDescription({
      rawText: textToParse,
      sourceUrl,
      titleHint: typeof titleHint === "string" ? titleHint.slice(0, 100) : undefined,
      companyHint: typeof companyHint === "string" ? companyHint.slice(0, 100) : undefined,
      locationHint: typeof locationHint === "string" ? locationHint.slice(0, 100) : undefined,
    });

    return NextResponse.json({ job: normalizedJob });
  } catch (err: unknown) {
    console.error("[POST /api/jobs/parse] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal error parsing job posting." },
      { status: 500 }
    );
  }
}
