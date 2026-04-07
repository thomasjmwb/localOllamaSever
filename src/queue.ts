export interface QueueStatus {
  queued: number;
  active: number;
  maxConcurrent: number;
}

interface QueueEntry {
  fn: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

export class RequestQueue {
  private readonly maxConcurrent: number;
  private readonly maxQueueSize: number;
  private active = 0;
  private readonly pending: QueueEntry[] = [];

  constructor(maxConcurrent: number, maxQueueSize: number) {
    this.maxConcurrent = maxConcurrent;
    this.maxQueueSize = maxQueueSize;
  }

  enqueue<T>(fn: () => Promise<T>): Promise<T> {
    if (this.pending.length >= this.maxQueueSize) {
      return Promise.reject(new QueueFullError(this.pending.length));
    }

    return new Promise<T>((resolve, reject) => {
      this.pending.push({
        fn,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.drain();
    });
  }

  get status(): QueueStatus {
    return {
      queued: this.pending.length,
      active: this.active,
      maxConcurrent: this.maxConcurrent,
    };
  }

  private drain(): void {
    while (this.active < this.maxConcurrent && this.pending.length > 0) {
      const entry = this.pending.shift()!;
      this.active++;
      entry
        .fn()
        .then(entry.resolve)
        .catch(entry.reject)
        .finally(() => {
          this.active--;
          this.drain();
        });
    }
  }
}

export class QueueFullError extends Error {
  constructor(queueSize: number) {
    super(`Queue is full (${queueSize} pending requests)`);
    this.name = "QueueFullError";
  }
}
