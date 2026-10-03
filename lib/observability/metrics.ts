/**
 * lib/observability/metrics.ts
 *
 * Safe In-Memory Operational & AI Latency Metrics Engine for UBIX.
 *
 * Implements bounded sliding-window reservoirs for accurate p50, p95, and p99 calculation
 * without external dependency overhead or unbounded memory consumption.
 */

export interface LatencyPercentiles {
  count: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

const MAX_SAMPLES_PER_METRIC = 500;

class MetricsRegistry {
  private reservoirs = new Map<string, number[]>();

  /**
   * Records a latency measurement (in milliseconds) for an operation.
   */
  public recordMetric(metricName: string, durationMs: number): void {
    if (typeof durationMs !== "number" || isNaN(durationMs) || durationMs < 0) {
      return;
    }

    let samples = this.reservoirs.get(metricName);
    if (!samples) {
      samples = [];
      this.reservoirs.set(metricName, samples);
    }

    samples.push(durationMs);
    if (samples.length > MAX_SAMPLES_PER_METRIC) {
      samples.shift(); // Evict oldest sample to maintain sliding window
    }
  }

  /**
   * Calculates percentiles (p50, p95, p99) and summary stats for a metric.
   */
  public getPercentiles(metricName: string): LatencyPercentiles | null {
    const samples = this.reservoirs.get(metricName);
    if (!samples || samples.length === 0) {
      return null;
    }

    const sorted = [...samples].sort((a, b) => a - b);
    const count = sorted.length;
    const min = sorted[0];
    const max = sorted[count - 1];
    const sum = sorted.reduce((acc, val) => acc + val, 0);
    const avg = Math.round((sum / count) * 100) / 100;

    const getP = (p: number): number => {
      const index = Math.ceil((p / 100) * count) - 1;
      return sorted[Math.max(0, Math.min(count - 1, index))];
    };

    return {
      count,
      min,
      max,
      avg,
      p50: getP(50),
      p95: getP(95),
      p99: getP(99),
    };
  }

  /**
   * Returns a snapshot of all tracked metrics for diagnostics / health reporting.
   */
  public getSnapshot(): Record<string, LatencyPercentiles> {
    const result: Record<string, LatencyPercentiles> = {};
    for (const key of this.reservoirs.keys()) {
      const stats = this.getPercentiles(key);
      if (stats) {
        result[key] = stats;
      }
    }
    return result;
  }

  /**
   * Resets all metric reservoirs (useful for hermetic unit testing).
   */
  public reset(): void {
    this.reservoirs.clear();
  }
}

export const metrics = new MetricsRegistry();
