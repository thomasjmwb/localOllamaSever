# AGENTS.md

## Project Overview

This is a local HTTP service (Bun + TypeScript) that wraps a local Ollama instance, exposing a simple JSON API for other services to interact with the LLM. There are no external frameworks -- the server uses `Bun.serve()` and built-in `fetch()` only.

## Architecture

```
Calling Service  -->  POST /chat  -->  Bun HTTP Service (port 3000)
                                            |
                                      POST /api/chat
                                            |
                                            v
                                       Ollama (port 11434)
```

## How Ollama Works

- Ollama exposes a REST API at `http://localhost:11434` (started via `ollama serve`, usually auto-starts on boot).
- When a request arrives, Ollama loads the requested model into GPU/CPU memory automatically.
- The model stays loaded for ~5 minutes of inactivity, then unloads to free memory.
- No manual model management is needed from this service's perspective.
- The currently configured model is `gemma4:e4b` (set via the `OLLAMA_MODEL` env var).
- Ollama docs: https://github.com/ollama/ollama/blob/main/docs/api.md

## Running the Service

```sh
bun install       # install dependencies
bun start         # start the server
bun dev           # start with file-watching (auto-restart on changes)
```

## Environment Configuration

Configured via `.env` (Bun loads it automatically -- do not use dotenv). See `.env.template` for the full list. Defaults:

| Variable       | Default                    | Description                    |
|----------------|----------------------------|--------------------------------|
| `PORT`         | `3000`                     | Port the HTTP service runs on  |
| `OLLAMA_URL`   | `http://localhost:11434`   | Ollama API base URL            |
| `OLLAMA_MODEL` | `gemma4:e4b`               | Model name passed to Ollama    |

## Tech Constraints

- **Runtime**: Bun (not Node.js). Use `bun` for all commands.
- **No frameworks**: No Express, Hono, etc. Use `Bun.serve()` for HTTP.
- **No external HTTP clients**: Use the built-in `fetch()`.
- See `.cursor/rules/use-bun-instead-of-node-vite-npm-pnpm.mdc` for detailed Bun API conventions.

## Project Structure

```
src/
  index.ts    - HTTP server entry point and route handling
  ollama.ts   - Ollama API client (chat + health check)
  config.ts   - Environment-based configuration with defaults
  types.ts    - TypeScript interfaces for all request/response shapes
```
