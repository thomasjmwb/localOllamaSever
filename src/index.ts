import { config } from "./config.ts";
import { chat, checkConnection } from "./ollama.ts";
import type { ChatRequest, HealthResponse } from "./types.ts";

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

  try {
    const result = await chat(body.message, body.history, body.system);
    return json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Chat error:", message);
    return json({ error: `Ollama request failed: ${message}` }, 502);
  }
}

async function handleHealth(): Promise<Response> {
  const connected = await checkConnection();
  const data: HealthResponse = {
    status: connected ? "ok" : "error",
    model: config.ollamaModel,
    ollamaConnected: connected,
  };
  return json(data, connected ? 200 : 503);
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
      default:
        return json({ error: "Not found" }, 404);
    }
  },
});

console.log(`Local AI Service running on http://localhost:${server.port}`);
console.log(`Model: ${config.ollamaModel}`);
console.log(`Ollama URL: ${config.ollamaUrl}`);
