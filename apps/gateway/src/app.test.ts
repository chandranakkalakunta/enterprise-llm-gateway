import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { parseEnv } from "./config/env.js";
import type { IdTokenClaims } from "./auth/types.js";

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
