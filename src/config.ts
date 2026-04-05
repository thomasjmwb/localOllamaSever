export const config = {
  port: Number(Bun.env.PORT ?? 3000),
  ollamaUrl: Bun.env.OLLAMA_URL ?? "http://localhost:11434",
  ollamaModel: Bun.env.OLLAMA_MODEL ?? "gemma4:e4b",
} as const;
