/**
 * /api/offers
 *
 * GET: Lists all recorded offers for the authenticated user and provides comparative analysis.
 * POST:
 *   - action: "record_offer" -> Records or updates an offer for a tracked application.
 *   - action: "compare" -> Factual side-by-side comparison across recorded offers.
 * DELETE: Removes an offer by id.
 *
 * Invariant: Never ranks offers or picks a "winner".
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/supabase/auth";
import { checkRateLimit, RATE_LIMIT_POLICIES } from "@/lib/security/rateLimit";
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

    const rl = checkRateLimit(`offers:${userId}`, RATE_LIMIT_POLICIES.PUBLIC_API);
    if (rl.isLimited) {
      return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const { action, applicationId, offer, offersToCompare } = body;

    if (action === "record_offer" || (!action && offer)) {
      if (!offer || !offer.company) {
        return NextResponse.json({ error: "Offer details with company name are required." }, { status: 400 });
      }

      const apps = await getUserApplications(userId);
      let app = applicationId ? apps.find((a: ApplicationRecord) => a.id === applicationId) : apps[0];

      if (!app) {
        const appId = `app_${Date.now()}`;
        app = {
          id: appId,
          userId,
          jobId: `job_${Date.now()}`,
          jobTitle: offer.role || "Job Offer",
          company: offer.company || "Employer",
          status: "OFFER",
          materials: [],
          timeline: [
            {
              id: `evt_${Date.now()}`,
              applicationId: appId,
              eventType: "OFFER_RECEIVED",
              description: `Recorded offer from ${offer.company}`,
              timestamp: new Date().toISOString(),
            },
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }

      const resolvedAppId = app.id;
      const newOffer: OfferRecord = {
        ...offer,
        id: offer.id || `off_${Date.now()}`,
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
            id: `evt_${Date.now()}`,
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
