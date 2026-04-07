# src/ AGENTS.md

## Module Responsibilities

| File         | Purpose                                                             |
|--------------|---------------------------------------------------------------------|
| `index.ts`   | HTTP server (`Bun.serve()`), route dispatch, request lifecycle (logging, queuing, metrics), CORS, error responses |
| `ollama.ts`  | Ollama API client -- `chat()`, `listModels()`, and `checkConnection()` |
| `config.ts`  | Single readonly config object sourced from env vars with defaults    |
| `types.ts`   | All TypeScript interfaces for requests, responses, and Ollama payloads |
| `queue.ts`   | `RequestQueue` class -- promise-based FIFO queue with concurrency limit |
| `logger.ts`  | Structured JSON logger with level filtering (debug/info/warn/error)  |
| `metrics.ts` | In-memory counters for requests, errors, durations, per-model stats  |

## Conventions

- All type definitions go in `types.ts`. Import them with `import type`.
- All Ollama interaction goes through `ollama.ts` -- never call the Ollama API directly from `index.ts`.
- Configuration is a single `config` object exported from `config.ts`. Access env vars there, not scattered across files.
- CORS headers (`Access-Control-Allow-Origin: *`) are applied to every response via the `corsHeaders` object in `index.ts`.
- Zero external npm dependencies. All features are built with Bun/TS built-ins.

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
  ],
  "model": "qwen3:14b",
  "format": { "type": "object", "properties": { "answer": { "type": "string" } }, "required": ["answer"] }
}
```

- `message` (string, required) -- the user's prompt.
- `system` (string, optional) -- system prompt prepended to the conversation.
- `history` (ChatMessage[], optional) -- prior conversation turns. Each has `role` ("user" | "assistant" | "system") and `content`.
- `model` (string, optional) -- Ollama model to use. Falls back to `config.defaultModel`.
- `format` ("json" | JsonSchema, optional) -- when set, Ollama constrains output to valid JSON matching the schema. The `reply` field will contain JSON-encoded text.

Response body (`ChatResponse`):

```json
{
  "reply": "TypeScript is a typed superset of JavaScript...",
  "model": "gemma4:e4b",
  "totalDuration": 1234567890
}
```

- `reply` -- the model's text response (JSON string when `format` is used).
- `model` -- which Ollama model produced the response.
- `totalDuration` -- total inference time in nanoseconds (from Ollama's `total_duration` field).

### GET /health

Response body (`HealthResponse`):

```json
{
  "status": "ok",
  "defaultModel": "gemma4:e4b",
  "ollamaConnected": true,
  "queue": { "queued": 0, "active": 0, "maxConcurrent": 1 }
}
```

- `status` -- "ok" if Ollama is reachable, "error" if not.
- `queue` -- current queue state.
- Returns HTTP 200 when connected, 503 when not.

### GET /models

Response body (`ModelsResponse`):

```json
{
  "defaultModel": "gemma4:e4b",
  "available": ["gemma4:e4b", "qwen3:14b"]
}
```

Lists all models installed in Ollama.

### GET /metrics

Response body (`MetricsSnapshot`):

```json
{
  "uptime": 3600,
  "totalRequests": 150,
  "totalErrors": 3,
  "avgDurationMs": 2340,
  "activeRequests": 1,
  "queue": { "queued": 2, "active": 1, "maxConcurrent": 1 },
  "perModel": {
    "gemma4:e4b": { "requests": 120, "errors": 1, "avgDurationMs": 2100 },
    "qwen3:14b": { "requests": 30, "errors": 2, "avgDurationMs": 3200 }
  }
}
```

## Ollama API Details

### Chat -- POST {OLLAMA_URL}/api/chat

We send:

```json
{
  "model": "gemma4:e4b",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "stream": false,
  "format": { "type": "object", "properties": {...}, "required": [...] }
}
```

- `stream: false` is critical -- without it, Ollama streams newline-delimited JSON chunks.
- `format` is optional. When provided, Ollama constrains token generation to match the JSON schema.

Ollama returns (`OllamaChatResponse`):

```json
{
  "model": "gemma4:e4b",
  "message": { "role": "assistant", "content": "..." },
  "total_duration": 1234567890,
  "done": true
}
```

### List models -- GET {OLLAMA_URL}/api/tags

Returns `{ models: [{ name, model, size, digest }] }`. Used by `listModels()` and `checkConnection()`.

## Request Lifecycle (index.ts handleChat)

1. Parse and validate request body (400 on failure)
2. Generate `requestId` (crypto.randomUUID()), log request start
3. Submit to queue: `queue.enqueue(() => chat(...))`
4. If queue full, return 429 immediately
5. On completion, record metrics and log result
6. Return response (200 on success, 502 on Ollama error)

## Queue (queue.ts)

- `RequestQueue` wraps task functions in a FIFO queue.
- Executes up to `maxConcurrent` tasks simultaneously.
- Rejects with `QueueFullError` when `pending.length >= maxQueueSize`.
- Exposes `status` for health/metrics endpoints.

## Testing

Tests live in `tests/` at the project root. Uses Bun's built-in test runner.

```
tests/
  queue.test.ts         - Unit tests for RequestQueue (no I/O, fast)
  metrics.test.ts       - Unit tests for metrics module (uses reset() for isolation)
  integration.test.ts   - HTTP integration tests (spawns server on port 3001)
```

Commands:
- `bun test` -- run all tests
- `bun test:unit` -- queue + metrics unit tests only (fast, no server/Ollama needed)
- `bun test:integration` -- starts the server and tests all HTTP endpoints

Integration tests have two sections:
- **Always-run**: input validation, routing, CORS, metrics shape (no Ollama needed)
- **Ollama-dependent**: health, models, chat -- skipped automatically if Ollama is not reachable. These double as health checks for the full pipeline.

The `metrics.ts` module exports a `reset()` function used by tests to clear accumulated state between test cases.

## Error Handling

| HTTP Status | When                                       |
|-------------|--------------------------------------------|
| 400         | Missing/invalid `message` field, bad JSON  |
| 404         | Unknown route                              |
| 405         | Non-POST request to `/chat`                |
| 429         | Queue is full (too many pending requests)  |
| 502         | Ollama error, unreachable, or invalid JSON response when `format` is set |
| 503         | `/health` when Ollama is disconnected      |
