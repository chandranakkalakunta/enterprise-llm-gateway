import { describe, expect, it } from "vitest";
import { createLogger, redactValue, requestLogShape } from "./logger.js";

describe("redactValue", () => {
  it("redacts Authorization and prompt-like keys", () => {
    const redacted = redactValue({
      authorization: "Bearer super-secret",
      prompt: "do not log me",
      messages: [{ role: "user", content: "secret question" }],
      path: "/v1/chat/completions",
    }) as Record<string, unknown>;
    expect(redacted.authorization).toBe("[redacted]");
    expect(redacted.prompt).toBe("[redacted]");
    expect(redacted.messages).toBe("[redacted]");
    expect(redacted.path).toBe("/v1/chat/completions");
  });
});

describe("requestLogShape", () => {
  it("does not include prompt or message fields", () => {
    const shape = requestLogShape({
      method: "POST",
      path: "/v1/chat/completions",
      status: 200,
      duration_ms: 12,
      request_id: "rid-1",
      principal_id: "sub-1",
    });
    expect(shape).toEqual({
      msg: "http_request",
      method: "POST",
      path: "/v1/chat/completions",
      status: 200,
      duration_ms: 12,
      request_id: "rid-1",
      principal_id: "sub-1",
    });
    expect(shape).not.toHaveProperty("prompt");
    expect(shape).not.toHaveProperty("messages");
    expect(shape).not.toHaveProperty("content");
  });
});

describe("createLogger", () => {
  it("writes one JSON line and redacts secrets if passed", () => {
    const lines: string[] = [];
    const log = createLogger((line) => {
      lines.push(line);
    });
    log.info({
      msg: "test",
      request_id: "r1",
      authorization: "Bearer abc",
      prompt: "hidden",
    });
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0] ?? "{}") as Record<string, unknown>;
    expect(parsed.level).toBe("info");
    expect(parsed.request_id).toBe("r1");
    expect(parsed.authorization).toBe("[redacted]");
    expect(parsed.prompt).toBe("[redacted]");
    expect(JSON.stringify(parsed)).not.toContain("Bearer abc");
    expect(JSON.stringify(parsed)).not.toContain("hidden");
  });
});
