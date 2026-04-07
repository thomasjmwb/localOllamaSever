import { config } from "./config.ts";
import { logger } from "./logger.ts";
import { beginRequest, endRequest, getSnapshot, recordRequest } from "./metrics.ts";
import { chat, checkConnection, listModels } from "./ollama.ts";
import { QueueFullError, RequestQueue } from "./queue.ts";
import type { ChatRequest, HealthResponse, ModelsResponse } from "./types.ts";

const queue = new RequestQueue(config.maxConcurrent, config.maxQueueSize);

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function handleChat(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed. Use POST." }, 405);
  }

  let body: ChatRequest;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  if (!body.message || typeof body.message !== "string") {
    return json({ error: "\"message\" field is required and must be a string." }, 400);
  }

  const requestId = crypto.randomUUID();
  const model = body.model ?? config.defaultModel;
  const startMs = Date.now();

  logger.info({
    event: "request_start",
    requestId,
    model,
    hasFormat: body.format != null,
  });

  beginRequest();

  try {
    const result = await queue.enqueue(() =>
      chat(body.message, body.history, body.system, body.model, body.format),
    );

    const durationMs = Date.now() - startMs;
    recordRequest(model, durationMs);

    logger.info({
      event: "request_complete",
      requestId,
      model,
      durationMs,
      status: 200,
    });

    return json(result);
  } catch (err) {
    const durationMs = Date.now() - startMs;

    if (err instanceof QueueFullError) {
      logger.warn({ event: "queue_full", requestId, queued: queue.status.queued });
      return json({ error: "Server is busy. Try again later." }, 429);
    }

    const message = err instanceof Error ? err.message : "Unknown error";
    recordRequest(model, durationMs, true);

    logger.error({
      event: "request_error",
      requestId,
      model,
      durationMs,
      error: message,
    });

    return json({ error: `Ollama request failed: ${message}` }, 502);
  } finally {
    endRequest();
  }
}

async function handleHealth(): Promise<Response> {
  const connected = await checkConnection();
  const data: HealthResponse = {
    status: connected ? "ok" : "error",
    defaultModel: config.defaultModel,
    ollamaConnected: connected,
    queue: queue.status,
  };
  return json(data, connected ? 200 : 503);
}

async function handleModels(): Promise<Response> {
  try {
    const available = await listModels();
    const data: ModelsResponse = {
      defaultModel: config.defaultModel,
      available,
    };
    return json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: `Failed to list models: ${message}` }, 502);
  }
}

function handleMetrics(): Response {
  return json(getSnapshot(queue.status));
}

const server = Bun.serve({
  port: config.port,
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    switch (url.pathname) {
      case "/chat":
        return handleChat(req);
      case "/health":
        return handleHealth();
      case "/models":
        return handleModels();
      case "/metrics":
        return handleMetrics();
      default:
        return json({ error: "Not found" }, 404);
    }
  },
});

logger.info({
  event: "server_start",
  port: server.port,
  defaultModel: config.defaultModel,
  ollamaUrl: config.ollamaUrl,
  maxConcurrent: config.maxConcurrent,
  maxQueueSize: config.maxQueueSize,
});
