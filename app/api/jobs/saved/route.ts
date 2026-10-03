/**
 * /api/jobs/saved
 *
 * GET: Fetch authenticated user's saved jobs and historical match analyses.
 * POST: Save or update a job with its explainable match result.
 * DELETE: Remove a saved job by id.
 *
 * Security: Strictly scoped to authenticated session user ID.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/supabase/auth";
import { getUserSavedJobs, saveUserSavedJob, deleteUserSavedJob } from "@/lib/db";
import { checkRateLimit, RATE_LIMIT_POLICIES } from "@/lib/security/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const savedJobs = await getUserSavedJobs(userId);
    return NextResponse.json({ savedJobs });
  } catch (err: unknown) {
    console.error("[GET /api/jobs/saved] Error:", err);
    return NextResponse.json({ error: "Failed to fetch saved jobs" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = checkRateLimit(`saved_job:${userId}`, RATE_LIMIT_POLICIES.PUBLIC_API);
    if (rl.isLimited) {
      return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const { job, lastAnalysis, notes } = body;

    if (!job || !job.id) {
      return NextResponse.json({ error: "Missing or invalid job data" }, { status: 400 });
    }

    const savedRecord = {
      id: String(job.id),
      job,
      savedAt: new Date().toISOString(),
      lastAnalysis,
      notes: typeof notes === "string" ? notes.slice(0, 500) : undefined,
    };

    const success = await saveUserSavedJob(userId, savedRecord);
    if (!success) {
      return NextResponse.json({ error: "Failed to save job" }, { status: 500 });
    }

    return NextResponse.json({ success: true, savedJob: savedRecord });
  } catch (err: unknown) {
    console.error("[POST /api/jobs/saved] Error:", err);
    return NextResponse.json({ error: "Failed to save job" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url, "http://localhost:3000");
    const jobId = url.searchParams.get("id");

    if (!jobId) {
      return NextResponse.json({ error: "Missing job ID" }, { status: 400 });
    }

    const success = await deleteUserSavedJob(userId, jobId);
    if (!success) {
      return NextResponse.json({ error: "Failed to delete saved job" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("[DELETE /api/jobs/saved] Error:", err);
    return NextResponse.json({ error: "Failed to delete saved job" }, { status: 500 });
  }
}
