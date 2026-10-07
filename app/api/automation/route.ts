/**
 * app/api/automation/route.ts
 *
 * UBIX Automation Control Center API Route
 *
 * Authenticated endpoints to:
 * - GET: list registered automations, user executions, and audit records.
 * - POST: trigger or confirm automations.
 *
 * Security Invariants:
 * - Strictly requires authenticated HMAC session cookie.
 * - Enforces 3 action classes: SAFE_AUTOMATIC, CONFIRMATION_REQUIRED, EXPLICIT_HUMAN_ACTION.
 * - Rejects cross-tenant execution and audit queries.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/security/session";
import {
  listAutomations,
  triggerAutomation,
  confirmAutomation,
  getUserExecutions,
  getUserExecutionsAsync,
  setAutomationStatus,
} from "@/lib/automation/engine";
import { getUserAutomationAuditLogs } from "@/lib/automation/auditLog";
import { getOrGenerateCorrelationId } from "@/lib/observability/correlation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const correlationId = getOrGenerateCorrelationId(req.headers);
  const token = req.cookies.get("cf_session")?.value;
  const session = token ? verifySessionToken(token) : null;

  if (!session || !session.userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Authentication required to access Automation Center." },
      { status: 401, headers: { "x-correlation-id": correlationId } }
    );
  }

  const automations = listAutomations();
  const executions = await getUserExecutionsAsync(session.userId);
  const auditLogs = getUserAutomationAuditLogs(session.userId, { limit: 25 });

  return NextResponse.json(
    {
      automations,
      executions,
      auditLogs,
      timestamp: new Date().toISOString(),
    },
    { status: 200, headers: { "x-correlation-id": correlationId } }
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const correlationId = getOrGenerateCorrelationId(req.headers);
  const token = req.cookies.get("cf_session")?.value;
  const session = token ? verifySessionToken(token) : null;

  if (!session || !session.userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Authentication required to manage automations." },
      { status: 401, headers: { "x-correlation-id": correlationId } }
    );
  }

  try {
    const body = await req.json();
    const { action, automationId, executionId, confirmationToken, enabled } = body;

    if (action === "toggle") {
      if (!automationId || typeof enabled !== "boolean") {
        return NextResponse.json(
          { code: "BAD_REQUEST", message: "Missing automationId or enabled boolean." },
          { status: 400, headers: { "x-correlation-id": correlationId } }
        );
      }
      const updated = setAutomationStatus(automationId, enabled);
      return NextResponse.json(
        { success: updated, automationId, enabled },
        { status: 200, headers: { "x-correlation-id": correlationId } }
      );
    }

    if (action === "confirm") {
      if (!executionId || !confirmationToken) {
        return NextResponse.json(
          { code: "BAD_REQUEST", message: "Confirmation requires executionId and confirmationToken." },
          { status: 400, headers: { "x-correlation-id": correlationId } }
        );
      }
      const result = await confirmAutomation(executionId, session.userId, confirmationToken);
      return NextResponse.json(
        { success: true, execution: result },
        { status: 200, headers: { "x-correlation-id": correlationId } }
      );
    }

    if (action === "trigger") {
      if (!automationId) {
        return NextResponse.json(
          { code: "BAD_REQUEST", message: "Trigger requires automationId." },
          { status: 400, headers: { "x-correlation-id": correlationId } }
        );
      }
      const execution = await triggerAutomation(
        automationId,
        session.userId,
        {
          type: "USER_REQUESTED",
          timestamp: new Date().toISOString(),
          payload: body.payload,
        }
      );
      return NextResponse.json(
        { success: true, execution },
        { status: 200, headers: { "x-correlation-id": correlationId } }
      );
    }

    return NextResponse.json(
      { code: "BAD_REQUEST", message: "Unsupported action. Expected 'toggle', 'confirm', or 'trigger'." },
      { status: 400, headers: { "x-correlation-id": correlationId } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { code: "INTERNAL_ERROR", message: err?.message || "Failed to process automation request." },
      { status: 500, headers: { "x-correlation-id": correlationId } }
    );
  }
}
