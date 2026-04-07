import { beforeEach, describe, expect, test } from "bun:test";
import {
  beginRequest,
  endRequest,
  getSnapshot,
  recordRequest,
  reset,
} from "../src/metrics.ts";
import type { QueueStatus } from "../src/queue.ts";

const mockQueueStatus: QueueStatus = { queued: 0, active: 0, maxConcurrent: 1 };

beforeEach(() => {
  reset();
});

describe("metrics", () => {
  test("starts empty", () => {
    const snap = getSnapshot(mockQueueStatus);
    expect(snap.totalRequests).toBe(0);
    expect(snap.totalErrors).toBe(0);
    expect(snap.avgDurationMs).toBe(0);
    expect(snap.activeRequests).toBe(0);
    expect(snap.perModel).toEqual({});
  });

  test("records a successful request", () => {
    recordRequest("test-model", 100);
    const snap = getSnapshot(mockQueueStatus);

    expect(snap.totalRequests).toBe(1);
    expect(snap.totalErrors).toBe(0);
    expect(snap.avgDurationMs).toBe(100);
  });

  test("records an error request", () => {
    recordRequest("test-model", 50, true);
    const snap = getSnapshot(mockQueueStatus);

    expect(snap.totalRequests).toBe(1);
    expect(snap.totalErrors).toBe(1);
  });

  test("tracks per-model stats", () => {
    recordRequest("model-a", 100);
    recordRequest("model-a", 200);
    recordRequest("model-b", 300, true);

    const snap = getSnapshot(mockQueueStatus);

    expect(snap.perModel["model-a"]).toEqual({
      requests: 2,
      errors: 0,
      avgDurationMs: 150,
    });
    expect(snap.perModel["model-b"]).toEqual({
      requests: 1,
      errors: 1,
      avgDurationMs: 300,
    });
  });

  test("computes average duration", () => {
    recordRequest("m", 100);
    recordRequest("m", 200);
    recordRequest("m", 300);

    const snap = getSnapshot(mockQueueStatus);
    expect(snap.avgDurationMs).toBe(200);
  });

  test("tracks active requests", () => {
    beginRequest();
    beginRequest();
    expect(getSnapshot(mockQueueStatus).activeRequests).toBe(2);

    endRequest();
    expect(getSnapshot(mockQueueStatus).activeRequests).toBe(1);

    endRequest();
    expect(getSnapshot(mockQueueStatus).activeRequests).toBe(0);
  });

  test("includes queue status in snapshot", () => {
    const queueStatus: QueueStatus = { queued: 5, active: 2, maxConcurrent: 3 };
    const snap = getSnapshot(queueStatus);

    expect(snap.queue).toEqual(queueStatus);
  });
});
