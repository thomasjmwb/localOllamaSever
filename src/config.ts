type LogLevel = "debug" | "info" | "warn" | "error";

function parseLogLevel(value: string | undefined): LogLevel {
  const valid: LogLevel[] = ["debug", "info", "warn", "error"];
  const lower = (value ?? "info").toLowerCase() as LogLevel;
  return valid.includes(lower) ? lower : "info";
}

export const config = {
  port: Number(Bun.env.PORT ?? 3000),
  ollamaUrl: Bun.env.OLLAMA_URL ?? "http://localhost:11434",
  defaultModel: Bun.env.OLLAMA_MODEL ?? "gemma4:e4b",
  maxConcurrent: Number(Bun.env.MAX_CONCURRENT ?? 1),
  maxQueueSize: Number(Bun.env.MAX_QUEUE_SIZE ?? 50),
  logLevel: parseLogLevel(Bun.env.LOG_LEVEL),
} as const;
