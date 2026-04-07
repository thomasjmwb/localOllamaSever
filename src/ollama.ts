import { config } from "./config.ts";
import { logger } from "./logger.ts";
import type {
  ChatMessage,
  ChatResponse,
  JsonSchema,
  OllamaChatResponse,
  OllamaTagsResponse,
} from "./types.ts";

export async function chat(
  message: string,
  history: ChatMessage[] = [],
  system?: string,
  model?: string,
  format?: "json" | JsonSchema,
): Promise<ChatResponse> {
  const messages: ChatMessage[] = [];

  if (system) {
    messages.push({ role: "system", content: system });
  }

  messages.push(...history);
  messages.push({ role: "user", content: message });

  const resolvedModel = model ?? config.defaultModel;

  const body: Record<string, unknown> = {
    model: resolvedModel,
    messages,
    stream: false,
  };

  if (format) {
    body.format = format;
  }

  const response = await fetch(`${config.ollamaUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ollama returned ${response.status}: ${text}`);
  }

  const data = (await response.json()) as OllamaChatResponse;

  if (format) {
    const content = data.message.content.trim();
    try {
      JSON.parse(content);
    } catch {
      logger.error({
        event: "invalid_json_response",
        model: resolvedModel,
        rawContent: content.slice(0, 500),
      });
      throw new Error("Model returned invalid JSON despite format constraint");
    }
  }

  return {
    reply: data.message.content,
    model: data.model,
    totalDuration: data.total_duration,
  };
}

export async function listModels(): Promise<string[]> {
  const response = await fetch(`${config.ollamaUrl}/api/tags`, {
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status} from /api/tags`);
  }

  const data = (await response.json()) as OllamaTagsResponse;
  return data.models.map((m) => m.name);
}

export async function checkConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${config.ollamaUrl}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
