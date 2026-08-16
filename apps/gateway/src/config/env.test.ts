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
});
