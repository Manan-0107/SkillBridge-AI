/**
 * lib/automation/engine.ts
 *
 * UBIX Central Automation Engine
 *
 * Orchestrates all automated career workflows according to the strict 3-tier action policy:
 * - SAFE_AUTOMATIC: Runs automatically (analysis, monitoring, drafts, internal derived updates).
 * - CONFIRMATION_REQUIRED: Generates a proposed plan and requires user approval before execution.
 * - EXPLICIT_HUMAN_ACTION: NEVER runs automatically. Requires direct human initiation.
 *
 * Invariants:
 * - Idempotent execution (prevents duplicate triggers).
 * - Authenticated user-scoping on every operation.
 * - Complete audit trail of all automated operations.
 */

import {
  ActionClass,
  AutomationDefinition,
  AutomationExecution,
  AutomationTrigger,
  ExecutionState,
} from "./types";
import { recordAutomationAudit } from "./auditLog";
import {
  upsertAutomationExecutionDb,
  fetchAutomationExecutionDb,
} from "../db";

// Registered automations
const registeredAutomations = new Map<string, AutomationDefinition>();

// Active and historical executions per user: userId -> Map<executionId, AutomationExecution>
const userExecutions = new Map<string, Map<string, AutomationExecution>>();

// Idempotency cache: key -> timestamp
const idempotencyStore = new Map<string, number>();
const IDEMPOTENCY_WINDOW_MS = 60 * 1000; // 1 minute

/**
 * Registers an automation definition.
 */
export function registerAutomation(definition: AutomationDefinition): void {
  registeredAutomations.set(definition.id, { ...definition });
}

/**
 * Retrieves a registered automation definition.
 */
export function getAutomation(id: string): AutomationDefinition | undefined {
  return registeredAutomations.get(id);
}

/**
 * Lists all registered automations.
 */
export function listAutomations(): AutomationDefinition[] {
  return Array.from(registeredAutomations.values());
}

/**
 * Updates automation enabled state.
 */
export function setAutomationStatus(id: string, enabled: boolean): boolean {
  const existing = registeredAutomations.get(id);
  if (!existing) return false;
  existing.enabled = enabled;
  registeredAutomations.set(id, existing);
  return true;
}

/**
 * Dispatches an automation execution pipeline.
 */
export async function triggerAutomation(
  automationId: string,
  userId: string,
  trigger: AutomationTrigger,
  executor?: (exec: AutomationExecution) => Promise<Record<string, any>>
): Promise<AutomationExecution> {
  if (!userId) {
    throw new Error("Automation execution requires a valid, authenticated userId.");
  }

  const definition = registeredAutomations.get(automationId);
  if (!definition) {
    throw new Error(`Automation with ID '${automationId}' is not registered.`);
  }

  // Idempotency check: prevent runaway identical triggers
  const idempotencyKey = `${userId}:${automationId}:${trigger.type}:${trigger.sourceId || "default"}`;
  const now = Date.now();
  const lastRun = idempotencyStore.get(idempotencyKey);
  if (lastRun && now - lastRun < IDEMPOTENCY_WINDOW_MS) {
    const skippedExec: AutomationExecution = {
      id: `exec_skipped_${now}`,
      automationId,
      userId,
      trigger,
      actionClass: definition.actionClass,
      state: "SKIPPED",
      idempotencyKey,
      requiresConfirmation: false,
      plannedActions: [],
      executedActions: [],
      startedAt: new Date(now).toISOString(),
      completedAt: new Date(now).toISOString(),
      result: { reason: "Idempotent trigger deduplicated within 60s window." },
      provenance: "SYSTEM_AUTOMATION",
    };
    return skippedExec;
  }
  idempotencyStore.set(idempotencyKey, now);

  const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // Check action class policies
  if (definition.actionClass === "EXPLICIT_HUMAN_ACTION" && trigger.type !== "USER_ACTION") {
    // Strictly prohibit background automation from executing explicit human actions
    const rejectedExec: AutomationExecution = {
      id: executionId,
      automationId,
      userId,
      trigger,
      actionClass: definition.actionClass,
      state: "CANCELLED",
      idempotencyKey,
      requiresConfirmation: true,
      plannedActions: ["Direct human action required"],
      executedActions: [],
      startedAt: new Date(now).toISOString(),
      completedAt: new Date(now).toISOString(),
      error: "Security Policy: Action class EXPLICIT_HUMAN_ACTION cannot be triggered automatically.",
      provenance: "SYSTEM_AUTOMATION",
    };

    recordAutomationAudit({
      executionId,
      automationId,
      userId,
      actionClass: definition.actionClass,
      triggerType: trigger.type,
      state: "CANCELLED",
      summary: "Blocked automatic attempt to execute EXPLICIT_HUMAN_ACTION.",
      hasExternalSideEffects: false,
    });

    return rejectedExec;
  }

  if (definition.actionClass === "CONFIRMATION_REQUIRED") {
    // Propose plan, pause execution and wait for explicit confirmation
    const confirmationToken = `conf_${Math.random().toString(36).substring(2, 12)}`;
    const expiry = new Date(now + 5 * 60 * 1000).toISOString(); // 5 minute TTL

    const waitingExec: AutomationExecution = {
      id: executionId,
      automationId,
      userId,
      trigger,
      actionClass: definition.actionClass,
      state: "WAITING_FOR_CONFIRMATION",
      idempotencyKey,
      requiresConfirmation: true,
      confirmationToken,
      confirmationExpiry: expiry,
      plannedActions: [definition.description],
      executedActions: [],
      startedAt: new Date(now).toISOString(),
      provenance: "SYSTEM_AUTOMATION",
    };

    saveExecution(userId, waitingExec);

    recordAutomationAudit({
      executionId,
      automationId,
      userId,
      actionClass: definition.actionClass,
      triggerType: trigger.type,
      state: "WAITING_FOR_CONFIRMATION",
      summary: `Automation planned: '${definition.name}'. Awaiting user confirmation.`,
      hasExternalSideEffects: false,
    });

    return waitingExec;
  }

  // SAFE_AUTOMATIC: Run directly
  const activeExec: AutomationExecution = {
    id: executionId,
    automationId,
    userId,
    trigger,
    actionClass: definition.actionClass,
    state: "RUNNING",
    idempotencyKey,
    requiresConfirmation: false,
    plannedActions: [definition.description],
    executedActions: [],
    startedAt: new Date(now).toISOString(),
    provenance: "SYSTEM_AUTOMATION",
  };

  saveExecution(userId, activeExec);

  try {
    let resultPayload: Record<string, any> = {};
    if (executor) {
      resultPayload = await executor(activeExec);
    }

    activeExec.state = "COMPLETED";
    activeExec.executedActions = [...activeExec.plannedActions];
    activeExec.result = resultPayload;
    activeExec.completedAt = new Date().toISOString();

    recordAutomationAudit({
      executionId,
      automationId,
      userId,
      actionClass: definition.actionClass,
      triggerType: trigger.type,
      state: "COMPLETED",
      summary: `Automation '${definition.name}' completed successfully.`,
      details: resultPayload,
      hasExternalSideEffects: false,
    });
  } catch (err: any) {
    activeExec.state = "FAILED";
    activeExec.error = err?.message || "Execution encountered an error";
    activeExec.completedAt = new Date().toISOString();

    recordAutomationAudit({
      executionId,
      automationId,
      userId,
      actionClass: definition.actionClass,
      triggerType: trigger.type,
      state: "FAILED",
      summary: `Automation '${definition.name}' failed: ${activeExec.error}`,
      hasExternalSideEffects: false,
    });
  }

  saveExecution(userId, activeExec);
  return activeExec;
}

/**
 * Confirms and executes a pending automation.
 */
export async function confirmAutomation(
  executionId: string,
  userId: string,
  token: string,
  executor?: (exec: AutomationExecution) => Promise<Record<string, any>>
): Promise<AutomationExecution> {
  const userMap = userExecutions.get(userId);
  const exec = userMap?.get(executionId);

  if (!exec) {
    throw new Error("Automation execution not found or does not belong to the user.");
  }

  if (exec.state !== "WAITING_FOR_CONFIRMATION") {
    throw new Error(`Automation is not awaiting confirmation. Current state: ${exec.state}`);
  }

  if (exec.confirmationToken !== token) {
    throw new Error("Invalid confirmation token.");
  }

  if (exec.confirmationExpiry && new Date(exec.confirmationExpiry).getTime() < Date.now()) {
    exec.state = "CANCELLED";
    exec.error = "Confirmation token expired.";
    saveExecution(userId, exec);
    throw new Error("Confirmation token expired.");
  }

  // Token consumed (single-use)
  delete exec.confirmationToken;
  delete exec.confirmationExpiry;
  exec.state = "RUNNING";
  exec.provenance = "USER_CONFIRMED";
  saveExecution(userId, exec);

  try {
    let resultPayload: Record<string, any> = {};
    if (executor) {
      resultPayload = await executor(exec);
    }
    exec.state = "COMPLETED";
    exec.executedActions = [...exec.plannedActions];
    exec.result = resultPayload;
    exec.completedAt = new Date().toISOString();

    recordAutomationAudit({
      executionId: exec.id,
      automationId: exec.automationId,
      userId,
      actionClass: exec.actionClass,
      triggerType: exec.trigger.type,
      state: "COMPLETED",
      summary: `Confirmed automation '${exec.automationId}' executed successfully.`,
      details: resultPayload,
      hasExternalSideEffects: true,
    });
  } catch (err: any) {
    exec.state = "FAILED";
    exec.error = err?.message || "Execution failed";
    exec.completedAt = new Date().toISOString();

    recordAutomationAudit({
      executionId: exec.id,
      automationId: exec.automationId,
      userId,
      actionClass: exec.actionClass,
      triggerType: exec.trigger.type,
      state: "FAILED",
      summary: `Confirmed automation '${exec.automationId}' failed: ${exec.error}`,
      hasExternalSideEffects: false,
    });
  }

  saveExecution(userId, exec);
  return exec;
}

/**
 * Retrieves all executions for an authenticated user.
 */
export function getUserExecutions(userId: string): AutomationExecution[] {
  const userMap = userExecutions.get(userId);
  if (!userMap) return [];
  return Array.from(userMap.values()).reverse();
}

/**
 * Authoritatively retrieves all executions from the database.
 */
export async function getUserExecutionsAsync(userId: string): Promise<AutomationExecution[]> {
  if (!userId) return [];
  try {
    const dbRows = await fetchAutomationExecutionDb(userId);
    if (dbRows && Array.isArray(dbRows)) {
      let userMap = userExecutions.get(userId);
      if (!userMap) {
        userMap = new Map();
        userExecutions.set(userId, userMap);
      }
      for (const row of dbRows) {
        userMap.set(row.id, {
          id: row.id,
          automationId: row.automationId,
          userId: row.userId,
          actionClass: row.actionClass as any,
          state: row.state as ExecutionState,
          trigger: row.trigger as unknown as AutomationTrigger,
          idempotencyKey: `${row.userId}:${row.automationId}:${row.startedAt}`,
          requiresConfirmation: row.actionClass === "CONFIRMATION_REQUIRED",
          confirmationToken: row.confirmationToken,
          confirmationExpiry: row.confirmationExpiry,
          plannedActions: row.plannedActions,
          executedActions: row.executedActions,
          result: row.result,
          error: row.error,
          startedAt: row.startedAt,
          completedAt: row.completedAt,
          provenance: (row.provenance as any) || "SYSTEM_AUTOMATION",
        });
      }
    }
  } catch (err) {
    console.warn("[AutomationEngine] DB load warning:", (err as any)?.message);
  }

  return getUserExecutions(userId);
}

function saveExecution(userId: string, exec: AutomationExecution): void {
  let userMap = userExecutions.get(userId);
  if (!userMap) {
    userMap = new Map();
    userExecutions.set(userId, userMap);
  }
  userMap.set(exec.id, { ...exec });
  upsertAutomationExecutionDb({
    id: exec.id,
    userId,
    automationId: exec.automationId,
    actionClass: exec.actionClass,
    state: exec.state,
    trigger: exec.trigger as unknown as Record<string, unknown>,
    plannedActions: exec.plannedActions,
    executedActions: exec.executedActions,
    confirmationToken: exec.confirmationToken,
    confirmationExpiry: exec.confirmationExpiry,
    startedAt: exec.startedAt,
    completedAt: exec.completedAt,
    error: exec.error,
    result: exec.result,
    provenance: exec.provenance,
  }).catch(() => {});
}

/**
 * Resets automation stores for isolated tests.
 */
export function _resetAutomationEngine(): void {
  registeredAutomations.clear();
  userExecutions.clear();
  idempotencyStore.clear();
}
