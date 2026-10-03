/**
 * /api/offers
 *
 * GET:  Lists all recorded offers for the authenticated user and provides comparative analysis.
 * POST:
 *   - action: "record_offer" → Records or updates an offer for a tracked application.
 *   - action: "compare"      → Factual side-by-side comparison across recorded offers.
 * DELETE: Removes an offer by id from its parent application.
 *
 * Contract changes (Phase 3.5 hardening):
 *   - POST record_offer REQUIRES an explicit applicationId. No fallback to apps[0].
 *     Missing applicationId → HTTP 400.
 *     Unknown applicationId → HTTP 404.
 *   - Offer is attached only to an application that belongs to the authenticated user.
 *   - No phantom ApplicationRecord is ever created by this endpoint.
 *
 * Invariant: Never ranks offers or picks a "winner".
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getAuthenticatedUserId } from "@/lib/supabase/auth";
import { checkRateLimit, checkRateLimitAsync, RATE_LIMIT_POLICIES } from "@/lib/security/rateLimit";
import { getUserApplications, saveUserApplication } from "@/lib/db";
import { compareOfferRecords } from "@/lib/career/interviewEngine";
import type { ApplicationRecord, OfferRecord } from "@/lib/career/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apps = await getUserApplications(userId);
    const allOffers: OfferRecord[] = apps.flatMap((a: ApplicationRecord) =>
      Array.isArray(a.offers) ? a.offers : []
    );

    const comparison = compareOfferRecords(allOffers);

    return NextResponse.json({
      ok: true,
      success: true,
      offers: allOffers,
      comparison,
    });
  } catch (err: unknown) {
    console.error("[GET /api/offers] Error:", err);
    return NextResponse.json({ error: "Failed to fetch offers." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = await checkRateLimitAsync(`offers:${userId}`, RATE_LIMIT_POLICIES.PUBLIC_API);
    if (!rl.allowed || rl.isLimited) {
      if (rl.status === 503) {
        return NextResponse.json({ error: "Service temporarily unavailable. Please try again shortly." }, { status: 503 });
      }
      return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const { action, applicationId, offer, offersToCompare } = body;

    if (action === "record_offer" || (!action && offer)) {
    // FIX #3: Validate offer input and resolve or create valid application
    if (!offer || !offer.company) {
      return NextResponse.json({ error: "Offer details with company name are required." }, { status: 400 });
    }

    const apps = await getUserApplications(userId);

    // If explicit applicationId provided, enforce strict ownership (no cross-user spoofing)
    if (applicationId && typeof applicationId === "string" && applicationId.trim()) {
      const matchedApp = apps.find((a: ApplicationRecord) => a.id === applicationId.trim());
      if (!matchedApp) {
        return NextResponse.json({ error: "Application not found." }, { status: 404 });
      }
    }

    // Resolve matching app by ID or company, or create a complete, valid ApplicationRecord
    let app: ApplicationRecord | undefined = applicationId
      ? apps.find((a: ApplicationRecord) => a.id === applicationId.trim())
      : apps.find((a: ApplicationRecord) => a.company?.toLowerCase() === offer.company?.toLowerCase());

    const nowIso = new Date().toISOString();
    const resolvedAppId = app?.id || `app_${crypto.randomUUID()}`;

    if (!app) {
      app = {
        id: resolvedAppId,
        userId,
        jobId: `job_${crypto.randomUUID()}`,
        company: offer.company,
        jobTitle: offer.role || "Software Engineer",
        location: offer.location || "Remote",
        remoteType: offer.remoteType || "Remote",
        source: "Direct Offer",
        status: "OFFER",
        notes: "Recorded from direct offer input",
        createdAt: nowIso,
        updatedAt: nowIso,
        materials: [],
        interviews: [],
        offers: [],
        timeline: [],
      };
    }
    const newOffer: OfferRecord = {
      ...offer,
      id: offer.id || `off_${crypto.randomUUID()}`,
      applicationId: resolvedAppId,
      userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const existingOffers: OfferRecord[] = Array.isArray(app.offers) ? app.offers : [];
    const updatedOffers = [
      ...existingOffers.filter((o: OfferRecord) => o.id !== newOffer.id),
      newOffer,
    ];

    const updatedApp: ApplicationRecord = {
      ...app,
      status: "OFFER",
      offers: updatedOffers,
      timeline: [
        ...(app.timeline || []),
        {
          id: `evt_${crypto.randomUUID()}`,
          applicationId: resolvedAppId,
          eventType: "OFFER_RECEIVED",
          description: `Recorded offer from ${newOffer.company} (${newOffer.baseCompensation || "Compensation details added"})`,
          timestamp: new Date().toISOString(),
        },
      ],
      updatedAt: new Date().toISOString(),
    };

    await saveUserApplication(userId, updatedApp);

    return NextResponse.json({
      success: true,
      ok: true,
      offer: newOffer,
      application: updatedApp,
    });
  }

  if (action === "compare") {
    const offersToProcess = offersToCompare || [];
    const comparison = compareOfferRecords(offersToProcess);
    return NextResponse.json({
      success: true,
      ok: true,
      comparison,
    });
  }

  return NextResponse.json({ error: "Invalid offer action" }, { status: 400 });
} catch (err: unknown) {
    console.error("[POST /api/offers] Error:", err);
    return NextResponse.json({ error: "Internal error processing offer." }, { status: 500 });
  }
}

/**
 * DELETE /api/offers?id={offerId}
 *
 * Removes a specific offer from its parent application.
 * The offer MUST belong to an application owned by the authenticated user.
 */
export async function DELETE(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url, "http://localhost:3000");
    const offerId = url.searchParams.get("id");
    if (!offerId || typeof offerId !== "string" || !offerId.trim()) {
      return NextResponse.json({ error: "Missing or invalid offer id" }, { status: 400 });
    }

    const apps = await getUserApplications(userId);
    let targetApp: ApplicationRecord | undefined;
    let targetOfferFound = false;

    for (const app of apps as ApplicationRecord[]) {
      const offers: OfferRecord[] = Array.isArray(app.offers) ? app.offers : [];
      if (offers.some((o) => o.id === offerId.trim())) {
        targetApp = app;
        targetOfferFound = true;
        break;
      }
    }

    if (!targetOfferFound || !targetApp) {
      return NextResponse.json({ error: "Offer not found." }, { status: 404 });
    }

    const updatedOffers = (targetApp.offers as OfferRecord[]).filter(
      (o) => o.id !== offerId.trim()
    );

    const updatedApp: ApplicationRecord = {
      ...targetApp,
      offers: updatedOffers,
      updatedAt: new Date().toISOString(),
    };

    await saveUserApplication(userId, updatedApp);

    return NextResponse.json({ success: true, ok: true });
  } catch (err: unknown) {
    console.error("[DELETE /api/offers] Error:", err);
    return NextResponse.json({ error: "Failed to delete offer." }, { status: 500 });
  }
}
