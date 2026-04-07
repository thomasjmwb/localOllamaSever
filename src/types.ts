export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export type JsonSchema = Record<string, unknown>;

export interface ChatRequest {
  message: string;
  system?: string;
  history?: ChatMessage[];
  model?: string;
  format?: "json" | JsonSchema;
}

export interface ChatResponse {
  reply: string;
  model: string;
  totalDuration: number;
}

export interface HealthResponse {
  status: "ok" | "error";
  defaultModel: string;
  ollamaConnected: boolean;
  queue: { queued: number; active: number; maxConcurrent: number };
}

export interface ModelsResponse {
  defaultModel: string;
  available: string[];
}

export interface OllamaChatResponse {
  model: string;
  message: { role: string; content: string };
  total_duration: number;
  done: boolean;
}

export interface OllamaTagsResponse {
  models: { name: string; model: string; size: number; digest: string }[];
}
