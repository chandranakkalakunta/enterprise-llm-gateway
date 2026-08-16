import { describe, expect, it } from "vitest";
import { parseEnv } from "./env.js";

describe("parseEnv", () => {
  it("accepts valid env and applies defaults", () => {
    const env = parseEnv({});
    expect(env.NODE_ENV).toBe("development");
    expect(env.PORT).toBe(8080);
  });

  it("parses PORT from a string", () => {
    const env = parseEnv({ NODE_ENV: "test", PORT: "3000" });
    expect(env.NODE_ENV).toBe("test");
    expect(env.PORT).toBe(3000);
  });

  it("rejects an invalid NODE_ENV", () => {
    expect(() => parseEnv({ NODE_ENV: "staging" })).toThrow();
  });

  it("rejects a non-numeric PORT", () => {
    expect(() => parseEnv({ PORT: "not-a-port" })).toThrow();
  });

  it("defaults OIDC issuer and admin allow-list", () => {
    const env = parseEnv({});
    expect(env.OIDC_ISSUER).toBe("https://accounts.google.com");
    expect(env.ADMIN_EMAILS).toBe("admin@chandraailabs.com");
    expect(env.OIDC_CLIENT_ID).toBe("");
  });

  it("copies OIDC_CLIENT_ID into OIDC_AUDIENCE when audience is empty", () => {
    const env = parseEnv({ OIDC_CLIENT_ID: "client-123" });
    expect(env.OIDC_AUDIENCE).toBe("client-123");
  });

  it("defaults Grok adapter settings", () => {
    const env = parseEnv({});
    expect(env.GROK_API_KEY).toBe("");
    expect(env.GROK_BASE_URL).toBe("https://api.x.ai/v1");
    expect(env.GROK_DEFAULT_MODEL).toBe("grok-4.5");
    expect(env.GROK_TIMEOUT_MS).toBe(60_000);
  });
});
