/**
 * lib/automation/types.ts
 *
 * UBIX Automation Architecture Type Definitions
 *
 * Core Principles:
 * - 3 Strict Action Classes: SAFE_AUTOMATIC, CONFIRMATION_REQUIRED, EXPLICIT_HUMAN_ACTION
 * - 9 Explicit Execution States: PENDING, PLANNED, WAITING_FOR_CONFIRMATION, RUNNING,
 *   COMPLETED, PARTIALLY_COMPLETED, FAILED, CANCELLED, SKIPPED
 * - Every automation is user-owned, bounded, idempotent, and audited.
 */

export type ActionClass =
  | "SAFE_AUTOMATIC"
  | "CONFIRMATION_REQUIRED"
  | "EXPLICIT_HUMAN_ACTION";

export type ExecutionState =
  | "PENDING"
  | "PLANNED"
  | "WAITING_FOR_CONFIRMATION"
  | "RUNNING"
  | "COMPLETED"
  | "PARTIALLY_COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "SKIPPED";

export type AutomationTriggerType =
  | "USER_ACTION"
  | "PROFILE_CHANGE"
  | "SKILL_EVIDENCE_CHANGE"
  | "ROADMAP_MILESTONE"
  | "LEARNING_COMPLETION"
  | "PRACTICE_RESULT"
  | "RESUME_UPDATE"
  | "SAVED_JOB"
  | "NEW_MATCHING_JOB"
  | "APPLICATION_STATUS_CHANGE"
  | "INTERVIEW_SCHEDULED"
  | "INTERVIEW_COMPLETED"
  | "OFFER_RECEIVED"
  | "INACTIVITY_DETECTED"
  | "DEADLINE_APPROACHING"
  | "WEEKLY_SCHEDULE"
  | "USER_REQUESTED"
  | "ASSISTANT_INSTRUCTION";

export interface AutomationTrigger {
  type: AutomationTriggerType;
  sourceId?: string;
  payload?: Record<string, any>;
  timestamp: string;
}

export interface AutomationDefinition {
  id: string;
  name: string;
  description: string;
  actionClass: ActionClass;
  triggerType: AutomationTriggerType;
  enabled: boolean;
  scheduleCron?: string;
  maxRetries: number;
  timeoutMs: number;
}

export interface AutomationExecution {
  id: string;
  automationId: string;
  userId: string;
  trigger: AutomationTrigger;
  actionClass: ActionClass;
  state: ExecutionState;
  idempotencyKey: string;
  requiresConfirmation: boolean;
  confirmationToken?: string;
  confirmationExpiry?: string;
  plannedActions: string[];
  executedActions: string[];
  result?: Record<string, any>;
  error?: string;
  startedAt: string;
  completedAt?: string;
  provenance: "SYSTEM_AUTOMATION" | "USER_CONFIRMED";
}

export interface AutomationAuditRecord {
  id: string;
  executionId: string;
  automationId: string;
  userId: string;
  actionClass: ActionClass;
  triggerType: AutomationTriggerType;
  state: ExecutionState;
  timestamp: string;
  summary: string;
  details?: Record<string, any>;
  hasExternalSideEffects: boolean;
}
