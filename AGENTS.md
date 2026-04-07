# AGENTS.md

## Project Overview

This is a local HTTP service (Bun + TypeScript) that wraps a local Ollama instance, exposing a simple JSON API for other services to interact with the LLM. There are no external frameworks -- the server uses `Bun.serve()` and built-in `fetch()` only.

## Architecture

```
Calling Service  -->  POST /chat  -->  Bun HTTP Service (port 3000)
                                            |
                                       [Logger] log request start
                                            |
                                       [Queue] concurrency control
                                            |
                                       [Ollama Client] model selection + format
                                            |
                                      POST /api/chat
                                            |
                                            v
                                       Ollama (port 11434)
                                            |
                                       [Metrics] record duration, model, status
                                            |
                                       [Logger] log request complete
                                            |
                                            v
                                       Response to caller
```

## Key Features

- **Request queuing**: Concurrency-limited queue prevents GPU contention. Configurable via `MAX_CONCURRENT` and `MAX_QUEUE_SIZE`.
- **Multi-model routing**: Callers can specify a `model` per request; falls back to `OLLAMA_MODEL` default.
- **Structured output**: Pass a `format` field (JSON schema or `"json"`) to get schema-enforced responses from the model.
- **Logging**: Structured JSON logs to stdout with configurable `LOG_LEVEL`.
- **Metrics**: In-memory request tracking exposed via `GET /metrics`.

## How Ollama Works

- Ollama exposes a REST API at `http://localhost:11434` (started via `ollama serve`, usually auto-starts on boot).
- When a request arrives, Ollama loads the requested model into GPU/CPU memory automatically.
- The model stays loaded for ~5 minutes of inactivity, then unloads to free memory.
- No manual model management is needed from this service's perspective.
- The default model is `gemma4:e4b` (set via the `OLLAMA_MODEL` env var), but callers can request any installed model per-request.
- Ollama supports structured output via a `format` parameter on `/api/chat` (added in Ollama 0.5.0).
- Ollama docs: https://github.com/ollama/ollama/blob/main/docs/api.md

## Running the Service

```sh
bun install       # install dependencies
bun start         # start the server
bun dev           # start with file-watching (auto-restart on changes)
```

## Environment Configuration

Configured via `.env` (Bun loads it automatically -- do not use dotenv). See `.env.template` for the full list. Defaults:

| Variable         | Default                    | Description                              |
|------------------|----------------------------|------------------------------------------|
| `PORT`           | `3000`                     | Port the HTTP service runs on            |
| `OLLAMA_URL`     | `http://localhost:11434`   | Ollama API base URL                      |
| `OLLAMA_MODEL`   | `gemma4:e4b`               | Default model name passed to Ollama      |
| `MAX_CONCURRENT` | `1`                        | Max parallel requests to Ollama          |
| `MAX_QUEUE_SIZE` | `50`                       | Max queued requests before returning 429 |
| `LOG_LEVEL`      | `info`                     | Logging verbosity (debug/info/warn/error)|

## Tech Constraints

- **Runtime**: Bun (not Node.js). Use `bun` for all commands.
- **No frameworks**: No Express, Hono, etc. Use `Bun.serve()` for HTTP.
- **No external HTTP clients**: Use the built-in `fetch()`.
- **No external dependencies**: All features (queue, logging, metrics) are implemented with zero npm dependencies.
- See `.cursor/rules/use-bun-instead-of-node-vite-npm-pnpm.mdc` for detailed Bun API conventions.

## Project Structure

```
src/
  index.ts    - HTTP server entry point, routing, request lifecycle orchestration
  ollama.ts   - Ollama API client (chat, listModels, health check)
  config.ts   - Environment-based configuration with defaults
  types.ts    - TypeScript interfaces for all request/response shapes
  queue.ts    - Promise-based concurrency-limited request queue
  logger.ts   - Structured JSON logging to stdout
  metrics.ts  - In-memory metrics collection and reporting
```
