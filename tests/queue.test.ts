import { describe, expect, test } from "bun:test";
import { QueueFullError, RequestQueue } from "../src/queue.ts";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("RequestQueue", () => {
  test("executes a single task and returns its value", async () => {
    const queue = new RequestQueue(1, 10);
    const result = await queue.enqueue(() => Promise.resolve(42));
    expect(result).toBe(42);
  });

  test("respects concurrency limit of 1", async () => {
    const queue = new RequestQueue(1, 10);
    const order: number[] = [];

    const start = Date.now();
    await Promise.all([
      queue.enqueue(async () => { await delay(50); order.push(1); }),
      queue.enqueue(async () => { await delay(50); order.push(2); }),
      queue.enqueue(async () => { await delay(50); order.push(3); }),
    ]);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(140);
    expect(order).toEqual([1, 2, 3]);
  });

  test("runs tasks concurrently up to limit", async () => {
    const queue = new RequestQueue(2, 10);
    let peakActive = 0;
    let currentActive = 0;

    const task = async () => {
      currentActive++;
      peakActive = Math.max(peakActive, currentActive);
      await delay(50);
      currentActive--;
    };

    await Promise.all([
      queue.enqueue(task),
      queue.enqueue(task),
      queue.enqueue(task),
    ]);

    expect(peakActive).toBe(2);
  });

  test("rejects when queue is full", async () => {
    const queue = new RequestQueue(1, 2);

    // First task starts executing (leaves pending), second and third fill pending to maxQueueSize
    queue.enqueue(() => delay(300));
    queue.enqueue(() => delay(300));
    queue.enqueue(() => delay(300));

    try {
      await queue.enqueue(() => delay(300));
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(QueueFullError);
      expect((err as Error).message).toContain("full");
    }
  });

  test("propagates task errors", async () => {
    const queue = new RequestQueue(1, 10);

    try {
      await queue.enqueue(() => Promise.reject(new Error("task failed")));
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toBe("task failed");
    }
  });

  test("reports correct status", async () => {
    const queue = new RequestQueue(1, 10);
    expect(queue.status).toEqual({ queued: 0, active: 0, maxConcurrent: 1 });

    let resolveBlocker!: () => void;
    const blocker = new Promise<void>((r) => { resolveBlocker = r; });

    const p1 = queue.enqueue(() => blocker);
    queue.enqueue(() => Promise.resolve());

    await delay(10);
    expect(queue.status.active).toBe(1);
    expect(queue.status.queued).toBe(1);

    resolveBlocker();
    await p1;
    await delay(10);

    expect(queue.status.active).toBe(0);
    expect(queue.status.queued).toBe(0);
  });

  test("processes in FIFO order", async () => {
    const queue = new RequestQueue(1, 10);
    const order: string[] = [];

    await Promise.all([
      queue.enqueue(async () => { await delay(10); order.push("first"); }),
      queue.enqueue(async () => { await delay(10); order.push("second"); }),
      queue.enqueue(async () => { await delay(10); order.push("third"); }),
    ]);

    expect(order).toEqual(["first", "second", "third"]);
  });
});
