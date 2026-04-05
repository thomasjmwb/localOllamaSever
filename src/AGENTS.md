# src/ AGENTS.md

## Module Responsibilities

| File         | Purpose                                                        |
|--------------|----------------------------------------------------------------|
| `index.ts`   | HTTP server (`Bun.serve()`), route dispatch, CORS, error responses |
| `ollama.ts`  | Ollama API client -- `chat()` and `checkConnection()` functions |
| `config.ts`  | Single readonly config object sourced from env vars with defaults |
| `types.ts`   | All TypeScript interfaces for requests, responses, and Ollama payloads |

## Conventions

- All type definitions go in `types.ts`. Import them with `import type`.
- All Ollama interaction goes through `ollama.ts` -- never call the Ollama API directly from `index.ts`.
- Configuration is a single `config` object exported from `config.ts`. Access env vars there, not scattered across files.
- CORS headers (`Access-Control-Allow-Origin: *`) are applied to every response via the `corsHeaders` object in `index.ts`.

## API Endpoints

### POST /chat

Request body (`ChatRequest`):

```json
{
  "message": "What is TypeScript?",
  "system": "You are a helpful assistant.",
  "history": [
    { "role": "user", "content": "Hi" },
    { "role": "assistant", "content": "Hello!" }
  ]
}
```

- `message` (string, required) -- the user's prompt.
- `system` (string, optional) -- system prompt prepended to the conversation.
- `history` (ChatMessage[], optional) -- prior conversation turns. Each has `role` ("user" | "assistant" | "system") and `content`.

Response body (`ChatResponse`):

```json
{
  "reply": "TypeScript is a typed superset of JavaScript...",
  "model": "gemma4:e4b",
  "totalDuration": 1234567890
}
```

- `reply` -- the model's text response.
- `model` -- which Ollama model produced the response.
- `totalDuration` -- total inference time in nanoseconds (from Ollama's `total_duration` field).

### GET /health

Response body (`HealthResponse`):

```json
{
  "status": "ok",
  "model": "gemma4:e4b",
  "ollamaConnected": true
}
```

- `status` -- "ok" if Ollama is reachable, "error" if not.
- Returns HTTP 200 when connected, 503 when not.

## Ollama API Details

### Chat -- POST {OLLAMA_URL}/api/chat

We send:

```json
{
  "model": "gemma4:e4b",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "stream": false
}
```

Ollama returns (`OllamaChatResponse`):

```json
{
  "model": "gemma4:e4b",
  "message": { "role": "assistant", "content": "..." },
  "total_duration": 1234567890,
  "done": true
}
```

`stream: false` is critical -- without it, Ollama streams newline-delimited JSON chunks instead of a single response.

### Health check -- GET {OLLAMA_URL}/api/tags

A simple connectivity check. We call this endpoint with a 3-second `AbortSignal.timeout`. Returns `true`/`false` based on whether the request succeeds.

## Error Handling

| HTTP Status | When                                      |
|-------------|-------------------------------------------|
| 400         | Missing/invalid `message` field, bad JSON |
| 404         | Unknown route                             |
| 405         | Non-POST request to `/chat`               |
| 502         | Ollama returned an error or is unreachable during chat |
| 503         | `/health` when Ollama is disconnected     |
