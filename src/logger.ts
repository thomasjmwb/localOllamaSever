import { config } from "./config.ts";

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[config.logLevel];
}

function write(level: LogLevel, data: Record<string, unknown>): void {
  if (!shouldLog(level)) return;
  const entry = { timestamp: new Date().toISOString(), level, ...data };
  console.log(JSON.stringify(entry));
}

export const logger = {
  debug: (data: Record<string, unknown>) => write("debug", data),
  info: (data: Record<string, unknown>) => write("info", data),
  warn: (data: Record<string, unknown>) => write("warn", data),
  error: (data: Record<string, unknown>) => write("error", data),
};
