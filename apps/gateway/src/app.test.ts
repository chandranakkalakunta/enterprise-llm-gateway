import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { parseEnv } from "./config/env.js";
import type { IdTokenClaims } from "./auth/types.js";
import { ProviderError } from "./providers/types.js";

const testEnv = parseEnv({
  NODE_ENV: "test",
  OIDC_CLIENT_ID: "test-client-id",
  OIDC_CLIENT_SECRET: "test-client-secret",
  OIDC_AUDIENCE: "test-client-id",
  ADMIN_EMAILS: "admin@chandraailabs.com",
});

describe("GET /health", () => {
  it("returns 200 JSON without auth", async () => {
    const app = createApp();
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    await expect(res.json()).resolves.toEqual({ status: "ok", service: "gateway" });
  });

  it("sets x-request-id when missing and echoes an incoming one", async () => {
    const app = createApp();
    const generated = await app.request("/health");
    expect(generated.headers.get("x-request-id")).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    const echoed = await app.request("/health", { headers: { "x-request-id": "client-rid" } });
    expect(echoed.headers.get("x-request-id")).toBe("client-rid");
  });
});

describe("GET /metrics", () => {
  it("is public and counts requests", async () => {
    const app = createApp();
    await app.request("/health");
    const res = await app.request("/metrics");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { requests_total: number };
    expect(body.requests_total).toBeGreaterThanOrEqual(1);
  });
});

describe("GET /v1/me", () => {
  it("returns 401 when Authorization is missing", async () => {
    const app = createApp({ env: testEnv });
    const res = await app.request("/v1/me");
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ error: "unauthorized" });
  });

  it("returns 401 when the token is invalid", async () => {
    const app = createApp({
      env: testEnv,
      verifyIdToken: async () => {
        throw new Error("bad token");
      },
    });
    const res = await app.request("/v1/me", { headers: { authorization: "Bearer not-a-jwt" } });
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({ error: "unauthorized" });
  });

  it("returns identity for a valid mocked token", async () => {
    const claims: IdTokenClaims = {
      sub: "sub-123",
      email: "admin@chandraailabs.com",
      name: "Admin",
    };
    const app = createApp({
      env: testEnv,
      verifyIdToken: async (token) => {
        expect(token).toBe("good-token");
        return claims;
      },
    });
    const res = await app.request("/v1/me", { headers: { authorization: "Bearer good-token" } });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      sub: "sub-123",
      email: "admin@chandraailabs.com",
      name: "Admin",
      roles: ["admin"],
      authSource: "google_oidc",
    });
  });

  it("maps a non-admin email to user", async () => {
    const app = createApp({
      env: testEnv,
      verifyIdToken: async () => ({ sub: "sub-9", email: "dev@example.com" }),
    });
    const res = await app.request("/v1/me", { headers: { authorization: "Bearer x" } });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      email: "dev@example.com",
      roles: ["user"],
    });
  });
});

describe("GET /auth/login", () => {
  it("redirects to Google with state when OIDC is configured", async () => {
    const app = createApp({ env: testEnv });
    const res = await app.request("/auth/login");
    expect(res.status).toBe(302);
    const location = res.headers.get("location");
    expect(location).toMatch(/^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth/);
    expect(location).toContain("client_id=test-client-id");
    expect(res.headers.get("set-cookie")).toMatch(/ellmgw_oidc_state=/);
  });

  it("returns 503 when OIDC is not configured", async () => {
    const app = createApp({ env: parseEnv({ NODE_ENV: "test" }) });
    const res = await app.request("/auth/login");
    expect(res.status).toBe(503);
  });
});

describe("POST /v1/chat/completions", () => {
  const authed = {
    env: testEnv,
    verifyIdToken: async () => ({ sub: "sub-1", email: "dev@example.com" }),
  };

  it("returns 401 without credentials", async () => {
    const app = createApp({ env: testEnv });
    const res = await app.request("/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "stub", messages: [{ role: "user", content: "hi" }] }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 when the body is invalid", async () => {
    const app = createApp(authed);
    const res = await app.request("/v1/chat/completions", {
      method: "POST",
      headers: { authorization: "Bearer x", "content-type": "application/json" },
      body: JSON.stringify({ model: "stub", messages: [] }),
    });
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: "invalid_request",
      code: "invalid_body",
    });
  });

  it("returns 400 when stream is true", async () => {
    const app = createApp(authed);
    const res = await app.request("/v1/chat/completions", {
      method: "POST",
      headers: { authorization: "Bearer x", "content-type": "application/json" },
      body: JSON.stringify({
        model: "stub",
        stream: true,
        messages: [{ role: "user", content: "hi" }],
      }),
    });
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      code: "stream_not_implemented",
    });
  });

  it("returns 503 when GROK_API_KEY is missing", async () => {
    const app = createApp(authed);
    const res = await app.request("/v1/chat/completions", {
      method: "POST",
      headers: { authorization: "Bearer x", "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hello" }] }),
    });
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ code: "provider_not_configured" });
  });

  it("returns a 200 OpenAI-shaped completion from the adapter", async () => {
    const app = createApp({
      ...authed,
      env: parseEnv({
        NODE_ENV: "test",
        OIDC_CLIENT_ID: "test-client-id",
        OIDC_CLIENT_SECRET: "test-client-secret",
        GROK_API_KEY: "test-key",
      }),
      completeChat: async (_req, opts) => ({
        id: `chatcmpl-${opts.requestId}`,
        object: "chat.completion",
        created: 1,
        model: "grok-4.5",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: "hi from mock grok" },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
      }),
    });
    const res = await app.request("/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: "Bearer x",
        "content-type": "application/json",
        "x-request-id": "fixed-req-id",
      },
      body: JSON.stringify({
        model: "grok-4.5",
        messages: [{ role: "user", content: "hello" }],
      }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toBe("fixed-req-id");
    const json = (await res.json()) as {
      id: string;
      object: string;
      model: string;
      choices: { message: { role: string; content: string } }[];
    };
    expect(json.id).toBe("chatcmpl-fixed-req-id");
    expect(json.object).toBe("chat.completion");
    expect(json.model).toBe("grok-4.5");
    expect(json.choices[0]?.message.content).toBe("hi from mock grok");
    expect(json.choices[0]?.message.content).not.toContain("[stub]");
  });

  it("maps adapter timeout to 504", async () => {
    const app = createApp({
      ...authed,
      env: parseEnv({
        NODE_ENV: "test",
        OIDC_CLIENT_ID: "test-client-id",
        OIDC_CLIENT_SECRET: "test-client-secret",
        GROK_API_KEY: "test-key",
      }),
      completeChat: async () => {
        throw new ProviderError(504, "provider_timeout", "Grok request timed out");
      },
    });
    const res = await app.request("/v1/chat/completions", {
      method: "POST",
      headers: { authorization: "Bearer x", "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hello" }] }),
    });
    expect(res.status).toBe(504);
    await expect(res.json()).resolves.toMatchObject({ code: "provider_timeout" });
  });
});

describe("GET /auth/callback", () => {
  it("rejects a missing or mismatched state", async () => {
    const app = createApp({ env: testEnv });
    const missing = await app.request("/auth/callback?code=abc&state=nope");
    expect(missing.status).toBe(401);

    const mismatch = await app.request("/auth/callback?code=abc&state=nope", {
      headers: { cookie: "ellmgw_oidc_state=other.nonce" },
    });
    expect(mismatch.status).toBe(401);
  });
});
