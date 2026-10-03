/**
 * /api/applications
 *
 * GET: Lists authenticated user's tracked applications.
 * POST: Creates or updates an application record.
 * DELETE: Removes an application record by id.
 *
 * Security: Strictly scoped to session authenticated user.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/supabase/auth";
import { checkRateLimit, checkRateLimitAsync, RATE_LIMIT_POLICIES } from "@/lib/security/rateLimit";
import { getUserApplications, saveUserApplication, deleteUserApplication } from "@/lib/db";
import { createApplicationRecord } from "@/lib/career/copilot";
import type { ApplicationRecord } from "@/lib/career/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const applications = await getUserApplications(userId);
    return NextResponse.json({ applications });
  } catch (err: unknown) {
    console.error("[GET /api/applications] Error:", err);
    return NextResponse.json({ error: "Failed to fetch applications" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = await checkRateLimitAsync(`apps_post:${userId}`, RATE_LIMIT_POLICIES.PUBLIC_API);
    if (!rl.allowed || rl.isLimited) {
      if (rl.status === 503) {
        return NextResponse.json({ error: "Service temporarily unavailable. Please try again shortly." }, { status: 503 });
      }
      return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const { action, application, job, savedJobId, resumeVersionId, resumeVersionName, lastMatchResult } = body;

    // Action 1: Create application from a job
    if (action === "create" || (!application && job)) {
      if (!job || !job.title || !job.company) {
        return NextResponse.json({ error: "Job title and company are required to create an application." }, { status: 400 });
      }

      const newRecord = createApplicationRecord({
        userId,
        job,
        savedJobId,
        resumeVersionId,
        resumeVersionName,
        lastMatchResult,
      });

      const saved = await saveUserApplication(userId, newRecord);
      if (!saved) {
        return NextResponse.json({ error: "Failed to persist application record." }, { status: 500 });
      }

      return NextResponse.json({ success: true, application: newRecord });
    }

    // Action 2: Update existing application record
    if (application && application.id) {
      const existingList = await getUserApplications(userId);
      const existing = existingList.find((a: ApplicationRecord) => a.id === application.id);

      // FIX #6: Unconditionally reject unknown IDs — do not skip the ownership
      // check just because existingList is empty (new users with no applications).
      // This prevents a client-crafted application object with a fabricated id
      // from being injected when the list happens to be empty.
      if (!existing) {
        // Do not reveal whether the ID belongs to another user
        return NextResponse.json({ error: "Application not found or unauthorized" }, { status: 404 });
      }

      // Merge safely, preserving user ownership and timestamps
      const updatedRecord: ApplicationRecord = {
        ...existing,
        ...application,
        userId, // Enforce session userId strictly
        updatedAt: new Date().toISOString(),
      };

      const saved = await saveUserApplication(userId, updatedRecord);
      if (!saved) {
        return NextResponse.json({ error: "Failed to update application." }, { status: 500 });
      }

      return NextResponse.json({ success: true, application: updatedRecord });
    }

    return NextResponse.json({ error: "Invalid application payload" }, { status: 400 });
  } catch (err: unknown) {
    console.error("[POST /api/applications] Error:", err);
    return NextResponse.json({ error: "Failed to process application." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url, "http://localhost:3000");
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing application id" }, { status: 400 });
    }

    const existingList = await getUserApplications(userId);
    const existing = existingList.find((a: ApplicationRecord) => a.id === id);
    if (!existing) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const success = await deleteUserApplication(userId, id);
    if (!success) {
      return NextResponse.json({ error: "Failed to delete application" }, { status: 500 });
    }

    return NextResponse.json({ success: true, deletedId: id });
  } catch (err: unknown) {
    console.error("[DELETE /api/applications] Error:", err);
    return NextResponse.json({ error: "Failed to delete application" }, { status: 500 });
  }
}
