import { config } from "./config.ts";
import type { ChatMessage, ChatResponse, OllamaChatResponse } from "./types.ts";

export async function chat(
  message: string,
  history: ChatMessage[] = [],
  system?: string,
): Promise<ChatResponse> {
  const messages: ChatMessage[] = [];

  if (system) {
    messages.push({ role: "system", content: system });
  }

  messages.push(...history);
  messages.push({ role: "user", content: message });

  const response = await fetch(`${config.ollamaUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.ollamaModel,
      messages,
      stream: false,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ollama returned ${response.status}: ${body}`);
  }

  const data = (await response.json()) as OllamaChatResponse;

  return {
    reply: data.message.content,
    model: data.model,
    totalDuration: data.total_duration,
  };
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
