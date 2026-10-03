/**
 * lib/observability/tracing.ts
 *
 * Distributed Tracing & Span Lifecycle Management for UBIX.
 *
 * Invariant: Works seamlessly in zero-config local environments and connects to Sentry / OpenTelemetry
 * when configured (via SENTRY_DSN or OTEL_EXPORTER_OTLP_ENDPOINT).
 * Invariant: Never captures raw request/response bodies or secrets in span tags.
 */

import { logger, ObservabilityEvent } from "./logger";
import { metrics } from "./metrics";
import { safeRedact } from "./redaction";

export interface SpanContext {
  spanId: string;
  traceId: string;
  name: string;
  correlationId: string;
  startTime: number;
  metadata?: Record<string, unknown>;
}

export class Span {
  public readonly context: SpanContext;
  private ended = false;

  constructor(name: string, correlationId: string, metadata?: Record<string, unknown>) {
    this.context = {
      spanId: Math.random().toString(36).substring(2, 10),
      traceId: correlationId,
      name,
      correlationId,
      startTime: Date.now(),
      metadata: metadata ? (safeRedact(metadata) as Record<string, unknown>) : undefined,
    };
  }

  public end(options?: { status?: "ok" | "error"; errorCategory?: string; message?: string }): number {
    if (this.ended) return 0;
    this.ended = true;

    const durationMs = Date.now() - this.context.startTime;
    const isError = options?.status === "error";

    // Record latency in metrics registry
    metrics.recordMetric(this.context.name, durationMs);

    // If external Sentry is present, capture breadcrumb or span
    if (typeof (globalThis as any).Sentry?.addBreadcrumb === "function") {
      (globalThis as any).Sentry.addBreadcrumb({
        category: "trace.span",
        message: `${this.context.name} (${durationMs}ms)`,
        level: isError ? "error" : "info",
        data: {
          correlationId: this.context.correlationId,
          durationMs,
          errorCategory: options?.errorCategory,
        },
      });
    }

    const eventName: ObservabilityEvent = isError ? "request.failed" : "request.completed";
    if (isError) {
      logger.error(eventName, {
        correlationId: this.context.correlationId,
        operation: this.context.name,
        durationMs,
        status: "ERROR",
        errorCategory: options?.errorCategory || "INTERNAL_ERROR",
        message: options?.message,
        metadata: this.context.metadata,
      });
    } else {
      logger.info(eventName, {
        correlationId: this.context.correlationId,
        operation: this.context.name,
        durationMs,
        status: "OK",
        metadata: this.context.metadata,
      });
    }

    return durationMs;
  }
}

/**
 * Executes an asynchronous operation within an isolated, measured distributed trace span.
 */
export async function traceSpan<T>(
  name: string,
  correlationId: string,
  fn: (span: Span) => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<T> {
  const span = new Span(name, correlationId, metadata);
  try {
    const result = await fn(span);
    span.end({ status: "ok" });
    return result;
  } catch (error: any) {
    const errorCategory = error?.code || "INTERNAL_ERROR";
    span.end({
      status: "error",
      errorCategory,
      message: error?.message || String(error),
    });
    throw error;
  }
}
