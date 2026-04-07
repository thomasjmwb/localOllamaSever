# Local AI Service

A lightweight HTTP service (Bun + TypeScript) that wraps your local [Ollama](https://ollama.com) instance, providing a simple API for other services to interact with your local LLM.

Features: request queuing, multi-model routing, structured output (JSON schema), structured logging, and request metrics.

## Prerequisites

- [Bun](https://bun.sh) runtime installed
- [Ollama](https://ollama.com) installed and running (`ollama serve`)
- A model pulled (e.g. `ollama pull gemma4:e4b`)

## Setup

```bash
bun install
```

## Configuration

Copy `.env.template` to `.env` and edit as needed:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port the HTTP service listens on |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama API base URL |
| `OLLAMA_MODEL` | `gemma4:e4b` | Default model for chat requests |
| `MAX_CONCURRENT` | `1` | Max parallel requests to Ollama |
| `MAX_QUEUE_SIZE` | `50` | Max queued requests before returning 429 |
| `LOG_LEVEL` | `info` | Logging verbosity (debug/info/warn/error) |

## Usage

Start the service:

```bash
bun start
```

Start with file watching (auto-restart on changes):

```bash
bun dev
```

## API

### `POST /chat`

Send a message and receive a response from the model.

**Request:**

```json
{
  "message": "What is TypeScript?",
  "system": "You are a helpful assistant.",
  "history": [
    { "role": "user", "content": "Hi" },
    { "role": "assistant", "content": "Hello!" }
  ],
  "model": "qwen3:14b",
  "format": "json"
}
```

Only `message` is required. All other fields are optional:

- `system` -- system prompt prepended to the conversation
- `history` -- array of prior `{ role, content }` turns
- `model` -- override the default model for this request
- `format` -- `"json"` for free-form JSON, or a JSON schema object for structured output

**Response:**

```json
{
  "reply": "TypeScript is a typed superset of JavaScript...",
  "model": "gemma4:e4b",
  "totalDuration": 1234567890
}
```

### `GET /health`

Check service and Ollama connectivity.

```json
{
  "status": "ok",
  "defaultModel": "gemma4:e4b",
  "ollamaConnected": true,
  "queue": { "queued": 0, "active": 0, "maxConcurrent": 1 }
}
```

### `GET /models`

List available Ollama models.

```json
{
  "defaultModel": "gemma4:e4b",
  "available": ["gemma4:e4b", "qwen3:14b"]
}
```

### `GET /metrics`

Request metrics and queue status.

```json
{
  "uptime": 3600,
  "totalRequests": 150,
  "totalErrors": 3,
  "avgDurationMs": 2340,
  "activeRequests": 1,
  "queue": { "queued": 0, "active": 1, "maxConcurrent": 1 },
  "perModel": {
    "gemma4:e4b": { "requests": 120, "errors": 1, "avgDurationMs": 2100 }
  }
}
```

## Testing

Run all tests:

```bash
bun test
```

Run unit tests only (fast, no server or Ollama needed):

```bash
bun test:unit
```

Run integration tests (starts the server, Ollama-dependent tests skipped if Ollama is not running):

```bash
bun test:integration
```

The integration test suite doubles as a health check -- Ollama-dependent tests verify the full pipeline from HTTP request through to model response.

## Examples

Simple chat:

```bash
curl -X POST http://localhost:3000/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"message\": \"Hello, what can you do?\"}"
```

Chat with a specific model:

```bash
curl -X POST http://localhost:3000/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"message\": \"Summarize TypeScript\", \"model\": \"qwen3:14b\"}"
```

Structured output with JSON schema:

```bash
curl -X POST http://localhost:3000/chat ^
  -H "Content-Type: application/json" ^
  -d "{\"message\": \"What is the capital of France?\", \"format\": {\"type\": \"object\", \"properties\": {\"answer\": {\"type\": \"string\"}, \"confidence\": {\"type\": \"number\"}}, \"required\": [\"answer\", \"confidence\"]}}"
```
