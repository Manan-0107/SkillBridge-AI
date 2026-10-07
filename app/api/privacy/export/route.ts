/**
 * app/api/privacy/export/route.ts
 *
 * Authenticated Data Export Endpoint:
 * Produces a full JSON bundle of all personal career data belonging to the user.
 *
 * Security Requirements:
 * - Server-authoritative identity derivation only.
 * - Strictly strips all secrets, passwords, hash salts, tokens, and internal keys.
 * - Enforces Content-Disposition: attachment with timestamped filename.
 * - Audits the export event securely without leaking payload contents.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { getUserCareerMemoryAsync } from "@/lib/memory/careerMemory";
import { getUserEvidenceWalletAsync } from "@/lib/career/evidenceWallet";
import { getUserExecutionsAsync } from "@/lib/automation/engine";
import { getUserResumes, getUserApplications } from "@/lib/db";
import { getOrGenerateCorrelationId } from "@/lib/observability/correlation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const correlationId = getOrGenerateCorrelationId(req.headers);
  const user = await getAuthenticatedUser(req);

  if (!user || !user.id) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Authentication required to export data." },
      { status: 401, headers: { "x-correlation-id": correlationId } }
    );
  }

  try {
    const [memory, evidence, executions, resumes, applications] = await Promise.all([
      getUserCareerMemoryAsync(user.id),
      getUserEvidenceWalletAsync(user.id),
      getUserExecutionsAsync(user.id),
      getUserResumes(user.id),
      getUserApplications(user.id),
    ]);

    // Sanitize resumes: strip raw binary/hash internals, keep safe candidate text & analysis
    const sanitizedResumes = (resumes || []).map((r) => ({
      id: r.id,
      filename: r.filename,
      targetRole: r.target_role,
      atsScore: r.ats_score,
      matchedSkills: r.matched_skills,
      missingSkills: r.missing_skills,
      uploadedAt: r.uploaded_at,
    }));

    // Build complete, leak-free candidate export bundle
    const exportBundle = {
      version: "1.0.0",
      system: "UBIX Career OS",
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        name: user.name || null,
        isGuest: Boolean(user.isGuest),
      },
      careerMemory: memory,
      skillEvidenceWallet: evidence,
      automationExecutions: (executions || []).map((e) => ({
        id: e.id,
        automationId: e.automationId,
        actionClass: e.actionClass,
        state: e.state,
        startedAt: e.startedAt,
        completedAt: e.completedAt,
        plannedActions: e.plannedActions,
        executedActions: e.executedActions,
      })),
      resumes: sanitizedResumes,
      trackedApplications: (applications || []).map((a: any) => ({
        id: a.id,
        company: a.company,
        role: a.jobTitle || a.role,
        status: a.status,
        appliedAt: a.appliedDate || a.createdAt,
      })),
    };

    console.log(`[Privacy Export] Secure data export completed for user=${user.id} at=${new Date().toISOString()}`);

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `ubix-career-data-export-${dateStr}.json`;

    return new NextResponse(JSON.stringify(exportBundle, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, max-age=0",
        "x-correlation-id": correlationId,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: "Failed to generate user data export." },
      { status: 500, headers: { "x-correlation-id": correlationId } }
    );
  }
}
