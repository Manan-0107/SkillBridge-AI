/**
 * lib/observability/logger.ts
 *
 * Centralized Structured Logging Engine for UBIX.
 *
 * Invariant: Outputs machine-readable structured JSON lines.
 * Invariant: Always redacts secrets, credentials, tokens, PII, and full payloads via safeRedact.
 * Invariant: Follows standardized event vocabulary.
 */

import { safeRedact } from "./redaction";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type ObservabilityEvent =
  | "request.started"
  | "request.completed"
  | "request.failed"
  | "ai.request.started"
  | "ai.request.completed"
  | "ai.request.failed"
  | "ai.provider.selected"
  | "ai.provider.fallback"
  | "redis.request"
  | "redis.failure"
  | "redis.health"
  | "rate_limit.allowed"
  | "rate_limit.blocked"
  | "rate_limit.infrastructure_failure"
  | "resume.parse.started"
  | "resume.parse.completed"
  | "resume.parse.failed"
  | "external_api.request"
  | "external_api.success"
  | "external_api.failure"
  | "voice.connection.accepted"
  | "voice.connection.rejected"
  | "voice.connection.auth_failure"
  | "voice.connection.origin_rejected"
  | "voice.connection.rate_violation"
  | "voice.connection.oversized"
  | "voice.connection.idle_timeout"
  | "voice.connection.disconnected"
  | "db.operation.completed"
  | "db.operation.failed"
  | "system.health";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: ObservabilityEvent;
  correlationId?: string;
  service: string;
  operation?: string;
  durationMs?: number;
  status?: number | string;
  errorCategory?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

class StructuredLogger {
  private serviceName: string;

  constructor(serviceName = "ubix-core") {
    this.serviceName = serviceName;
  }

  private write(entry: LogEntry): void {
    const safeEntry: LogEntry = {
      timestamp: entry.timestamp || new Date().toISOString(),
      level: entry.level,
      event: entry.event,
      correlationId: entry.correlationId,
      service: entry.service || this.serviceName,
      operation: entry.operation,
      durationMs: entry.durationMs,
      status: entry.status,
      errorCategory: entry.errorCategory,
      message: entry.message ? safeRedact(entry.message) : undefined,
      metadata: entry.metadata ? (safeRedact(entry.metadata) as Record<string, unknown>) : undefined,
    };

    const serialized = JSON.stringify(safeEntry);

    if (entry.level === "error") {
      console.error(serialized);
    } else if (entry.level === "warn") {
      console.warn(serialized);
    } else {
      console.log(serialized);
    }
  }

  public info(event: ObservabilityEvent, params: Omit<LogEntry, "level" | "event" | "timestamp" | "service">): void {
    this.write({
      ...params,
      timestamp: new Date().toISOString(),
      level: "info",
      event,
      service: this.serviceName,
    });
  }

  public warn(event: ObservabilityEvent, params: Omit<LogEntry, "level" | "event" | "timestamp" | "service">): void {
    this.write({
      ...params,
      timestamp: new Date().toISOString(),
      level: "warn",
      event,
      service: this.serviceName,
    });
  }

  public error(event: ObservabilityEvent, params: Omit<LogEntry, "level" | "event" | "timestamp" | "service">): void {
    this.write({
      ...params,
      timestamp: new Date().toISOString(),
      level: "error",
      event,
      service: this.serviceName,
    });
  }

  public debug(event: ObservabilityEvent, params: Omit<LogEntry, "level" | "event" | "timestamp" | "service">): void {
    if (process.env.NODE_ENV !== "production") {
      this.write({
        ...params,
        timestamp: new Date().toISOString(),
        level: "debug",
        event,
        service: this.serviceName,
      });
    }
  }
}

export const logger = new StructuredLogger("ubix-core");
