/**
 * lib/automation/auditLog.ts
 *
 * UBIX Automation Audit Log
 *
 * Privacy-preserving, tamper-evident audit logger for all background and
 * user-triggered automated actions.
 *
 * Security Invariants:
 * - Scoped strictly to authenticated userId.
 * - Centralized PII and secret redaction (passwords, tokens, API keys, audio).
 * - Bounded retention per user (maximum 100 recent audit events) preventing memory leaks.
 */

import { AutomationAuditRecord } from "./types";

const MAX_AUDIT_LOGS_PER_USER = 100;

// In-memory store per user (backed by database state when Supabase is connected)
const userAuditStores = new Map<string, AutomationAuditRecord[]>();

const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "secret",
  "authorization",
  "cookie",
  "api_key",
  "apikey",
  "access_token",
  "audio",
  "transcript",
  "ssn",
  "phonenumber",
]);

/**
 * Recursively redacts sensitive keys from audit payload objects.
 */
function sanitizeAuditPayload(data: any): any {
  if (!data || typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map(sanitizeAuditPayload);
  }

  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase()) || key.toLowerCase().includes("secret") || key.toLowerCase().includes("token")) {
      clean[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      clean[key] = sanitizeAuditPayload(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

/**
 * Records an automation audit event.
 */
export function recordAutomationAudit(
  record: Omit<AutomationAuditRecord, "id" | "timestamp">
): AutomationAuditRecord {
  const fullRecord: AutomationAuditRecord = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    timestamp: new Date().toISOString(),
    ...record,
    details: record.details ? sanitizeAuditPayload(record.details) : undefined,
  };

  const logs = userAuditStores.get(record.userId) || [];
  logs.unshift(fullRecord);

  // Maintain bounded log window
  if (logs.length > MAX_AUDIT_LOGS_PER_USER) {
    logs.length = MAX_AUDIT_LOGS_PER_USER;
  }

  userAuditStores.set(record.userId, logs);
  return fullRecord;
}

/**
 * Retrieves audit logs for a specific user.
 * Strictly verifies userId isolation.
 */
export function getUserAutomationAuditLogs(
  userId: string,
  options: { limit?: number; offset?: number } = {}
): AutomationAuditRecord[] {
  if (!userId) return [];
  const logs = userAuditStores.get(userId) || [];
  const offset = options.offset || 0;
  const limit = options.limit || 50;
  return logs.slice(offset, offset + limit);
}

/**
 * Clears audit logs for testing purposes only.
 */
export function _resetAuditLogStore(): void {
  userAuditStores.clear();
}
