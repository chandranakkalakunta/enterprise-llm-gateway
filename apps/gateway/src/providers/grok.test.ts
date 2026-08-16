import { describe, expect, it, vi } from "vitest";
import { createGrokCompleter } from "./grok.js";
import { ProviderError } from "./types.js";

const request = { messages: [{ role: "user" as const, content: "hello" }] };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("createGrokCompleter", () => {
  it("POSTs to Grok and normalizes an OpenAI-shaped success", async () => {
    const fetchFn = vi.fn(async (url: string | URL, init?: RequestInit) => {
      expect(String(url)).toBe("https://api.x.ai/v1/chat/completions");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({ authorization: "Bearer test-key" });
      const body = JSON.parse(String(init?.body)) as { model: string; stream: boolean };
      expect(body.model).toBe("grok-4.5");
      expect(body.stream).toBe(false);
      return jsonResponse(200, {
        id: "chatcmpl-up",
        object: "chat.completion",
        created: 1,
        model: "grok-4.5",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "hi from grok" },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 },
      });
    });

    const complete = createGrokCompleter({
      apiKey: "test-key",
      baseUrl: "https://api.x.ai/v1",
      defaultModel: "grok-4.5",
      timeoutMs: 5000,
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    const result = await complete(request, { requestId: "r1" });
    expect(result.choices[0]?.message.content).toBe("hi from grok");
    expect(result.model).toBe("grok-4.5");
    expect(result.id).toBe("chatcmpl-up");
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it("uses the request model when provided", async () => {
    const fetchFn = vi.fn(async (_url: string | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { model: string };
      expect(body.model).toBe("grok-3");
      return jsonResponse(200, {
        choices: [{ message: { content: "ok" } }],
      });
    });

    const complete = createGrokCompleter({
      apiKey: "k",
      baseUrl: "https://api.x.ai/v1/",
      defaultModel: "grok-4.5",
      timeoutMs: 5000,
      fetchFn: fetchFn as unknown as typeof fetch,
    });

    const result = await complete(
      { model: "grok-3", messages: request.messages },
      { requestId: "r2" },
    );
    expect(result.model).toBe("grok-3");
  });

  it("maps upstream 401 to ProviderError 502", async () => {
    const complete = createGrokCompleter({
      apiKey: "k",
      baseUrl: "https://api.x.ai/v1",
      defaultModel: "grok-4.5",
      timeoutMs: 5000,
      fetchFn: async () => jsonResponse(401, { error: "unauthorized" }),
    });

    await expect(complete(request, { requestId: "r3" })).rejects.toMatchObject({
      name: "ProviderError",
      status: 502,
      code: "provider_auth_failed",
    } satisfies Partial<ProviderError>);
  });

  it("maps abort/timeout to 504", async () => {
    const complete = createGrokCompleter({
      apiKey: "k",
      baseUrl: "https://api.x.ai/v1",
      defaultModel: "grok-4.5",
      timeoutMs: 5000,
      fetchFn: async () => {
        const err = new Error("aborted");
        err.name = "AbortError";
        throw err;
      },
    });

    await expect(complete(request, { requestId: "r4" })).rejects.toMatchObject({
      status: 504,
      code: "provider_timeout",
    });
  });
});
