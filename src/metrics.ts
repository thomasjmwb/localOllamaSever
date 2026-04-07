import type { QueueStatus } from "./queue.ts";

interface ModelMetrics {
  requests: number;
  errors: number;
  totalDurationMs: number;
}

export interface MetricsSnapshot {
  uptime: number;
  totalRequests: number;
  totalErrors: number;
  avgDurationMs: number;
  activeRequests: number;
  queue: QueueStatus;
  perModel: Record<string, { requests: number; errors: number; avgDurationMs: number }>;
}

const startTime = Date.now();

let totalRequests = 0;
let totalErrors = 0;
let totalDurationMs = 0;
let activeRequests = 0;
const perModel = new Map<string, ModelMetrics>();

export function beginRequest(): void {
  activeRequests++;
}

export function endRequest(): void {
  activeRequests--;
}

export function recordRequest(
  model: string,
  durationMs: number,
  error?: boolean,
): void {
  totalRequests++;
  totalDurationMs += durationMs;
  if (error) totalErrors++;

  let entry = perModel.get(model);
  if (!entry) {
    entry = { requests: 0, errors: 0, totalDurationMs: 0 };
    perModel.set(model, entry);
  }
  entry.requests++;
  entry.totalDurationMs += durationMs;
  if (error) entry.errors++;
}

export function reset(): void {
  totalRequests = 0;
  totalErrors = 0;
  totalDurationMs = 0;
  activeRequests = 0;
  perModel.clear();
}

export function getSnapshot(queueStatus: QueueStatus): MetricsSnapshot {
  const perModelSnapshot: MetricsSnapshot["perModel"] = {};
  for (const [model, m] of perModel) {
    perModelSnapshot[model] = {
      requests: m.requests,
      errors: m.errors,
      avgDurationMs: m.requests > 0 ? Math.round(m.totalDurationMs / m.requests) : 0,
    };
  }

  return {
    uptime: Math.round((Date.now() - startTime) / 1000),
    totalRequests,
    totalErrors,
    avgDurationMs: totalRequests > 0 ? Math.round(totalDurationMs / totalRequests) : 0,
    activeRequests,
    queue: queueStatus,
    perModel: perModelSnapshot,
  };
}
