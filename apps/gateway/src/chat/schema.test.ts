import { describe, expect, it } from "vitest";
import { chatCompletionRequestSchema, lastUserContent } from "./schema.js";

describe("chatCompletionRequestSchema", () => {
  it("accepts a minimal OpenAI-shaped body", () => {
    const parsed = chatCompletionRequestSchema.parse({
      model: "stub",
      messages: [{ role: "user", content: "hello" }],
    });
    expect(parsed.model).toBe("stub");
    expect(parsed.messages).toHaveLength(1);
  });

  it("rejects empty messages", () => {
    const result = chatCompletionRequestSchema.safeParse({ model: "stub", messages: [] });
    expect(result.success).toBe(false);
  });

  it("rejects missing model", () => {
    const result = chatCompletionRequestSchema.safeParse({
      messages: [{ role: "user", content: "hi" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("lastUserContent", () => {
  it("returns the last user message", () => {
    expect(
      lastUserContent([
        { role: "system", content: "sys" },
        { role: "user", content: "one" },
        { role: "assistant", content: "ok" },
        { role: "user", content: "two" },
      ]),
    ).toBe("two");
  });
});
