# Local AI Service

A lightweight HTTP service (Bun + TypeScript) that wraps your local [Ollama](https://ollama.com) instance, providing a simple API for other services to interact with your local LLM.

## Prerequisites

- [Bun](https://bun.sh) runtime installed
- [Ollama](https://ollama.com) installed and running (`ollama serve`)
- A model pulled (e.g. `ollama pull gemma4:e4b`)

## Setup

```bash
bun install
```

## Configuration

Edit `.env` or set environment variables:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port the HTTP service listens on |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama API base URL |
| `OLLAMA_MODEL` | `gemma4:e4b` | Model to use for chat |

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
  ]
}
```

Only `message` is required. `system` and `history` are optional.

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

**Response:**

```json
{
  "status": "ok",
  "model": "gemma4:e4b",
  "ollamaConnected": true
}
```

## Example

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d "{\"message\": \"Hello, what can you do?\"}"
```
