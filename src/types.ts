export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatRequest {
  message: string;
  system?: string;
  history?: ChatMessage[];
}

export interface ChatResponse {
  reply: string;
  model: string;
  totalDuration: number;
}

export interface HealthResponse {
  status: "ok" | "error";
  model: string;
  ollamaConnected: boolean;
}

export interface OllamaChatResponse {
  model: string;
  message: { role: string; content: string };
  total_duration: number;
  done: boolean;
}
