import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Subprocess } from "bun";

const PORT = 3001;
const BASE = `http://localhost:${PORT}`;

let server: Subprocess;
let serverAlive = true;

async function waitForServer(url: string, timeoutMs = 10000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/metrics`);
      if (res.ok) return;
    } catch { /* not ready yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Server did not start within ${timeoutMs}ms`);
}

async function checkOllamaAvailable(): Promise<boolean> {
  try {
    const res = await fetch("http://localhost:11434/api/tags", {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureServer(): Promise<void> {
  if (!serverAlive) throw new Error("Server was killed by a previous test timeout");
  try {
    await fetch(`${BASE}/metrics`, { signal: AbortSignal.timeout(2000) });
  } catch {
    serverAlive = false;
    throw new Error("Server is not reachable");
  }
}

const ollamaAvailable = await checkOllamaAvailable();

beforeAll(async () => {
  server = Bun.spawn(["bun", "run", "src/index.ts"], {
    cwd: import.meta.dir + "/..",
    env: { ...process.env, PORT: String(PORT), LOG_LEVEL: "error" },
    stdout: "ignore",
    stderr: "ignore",
  });

  await waitForServer(BASE);
});

afterAll(() => {
  try { server.kill(); } catch { /* already dead */ }
});

describe("HTTP basics", () => {
  test("POST /chat with missing body returns 400", async () => {
    const res = await fetch(`${BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Invalid JSON");
  });

  test("POST /chat with empty object returns 400", async () => {
    const res = await fetch(`${BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("message");
  });

  test("POST /chat with non-string message returns 400", async () => {
    const res = await fetch(`${BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: 123 }),
    });
    expect(res.status).toBe(400);
  });

  test("GET /chat returns 405", async () => {
    const res = await fetch(`${BASE}/chat`);
    expect(res.status).toBe(405);
  });

  test("GET /unknown-route returns 404", async () => {
    const res = await fetch(`${BASE}/does-not-exist`);
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toContain("Not found");
  });

  test("OPTIONS /chat returns 204 with CORS headers", async () => {
    const res = await fetch(`${BASE}/chat`, { method: "OPTIONS" });
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });

  test("GET /metrics returns valid shape", async () => {
    const res = await fetch(`${BASE}/metrics`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(typeof data.uptime).toBe("number");
    expect(typeof data.totalRequests).toBe("number");
    expect(typeof data.totalErrors).toBe("number");
    expect(typeof data.avgDurationMs).toBe("number");
    expect(typeof data.activeRequests).toBe("number");
    expect(data.queue).toBeDefined();
    expect(typeof data.queue.queued).toBe("number");
    expect(typeof data.queue.active).toBe("number");
    expect(data.perModel).toBeDefined();
  });

  test("responses include CORS headers", async () => {
    const res = await fetch(`${BASE}/metrics`);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});

describe("Ollama-dependent", () => {
  test.skipIf(!ollamaAvailable)("GET /health returns ok when Ollama is running", async () => {
    const res = await fetch(`${BASE}/health`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.ollamaConnected).toBe(true);
    expect(typeof data.defaultModel).toBe("string");
    expect(data.queue).toBeDefined();
  });

  test.skipIf(!ollamaAvailable)("GET /models returns available models", async () => {
    const res = await fetch(`${BASE}/models`);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(typeof data.defaultModel).toBe("string");
    expect(Array.isArray(data.available)).toBe(true);
    expect(data.available.length).toBeGreaterThan(0);
  });

  test.skipIf(!ollamaAvailable)("POST /chat basic request returns valid response", async () => {
    await ensureServer();
    const res = await fetch(`${BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Say hi", system: "Reply in one word only." }),
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(typeof data.reply).toBe("string");
    expect(data.reply.length).toBeGreaterThan(0);
    expect(typeof data.model).toBe("string");
    expect(typeof data.totalDuration).toBe("number");
  }, 120_000);

  test.skipIf(!ollamaAvailable)("POST /chat with model override uses specified model", async () => {
    await ensureServer();
    const modelsRes = await fetch(`${BASE}/models`);
    const { available } = await modelsRes.json();
    const model = available[0];

    const res = await fetch(`${BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Say ok", system: "Reply in one word only.", model }),
    });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.model).toContain(model.split(":")[0]);
  }, 120_000);

  test.skipIf(!ollamaAvailable)("POST /chat updates metrics", async () => {
    await ensureServer();
    const beforeRes = await fetch(`${BASE}/metrics`);
    const before = await beforeRes.json();

    await fetch(`${BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Say yes", system: "Reply in one word only." }),
    });

    const afterRes = await fetch(`${BASE}/metrics`);
    const after = await afterRes.json();

    expect(after.totalRequests).toBeGreaterThan(before.totalRequests);
  }, 120_000);
});
