import { describe, expect, it } from "vitest";
import { stubChatCompletion } from "./stub.js";

describe("stubChatCompletion", () => {
  it("returns an OpenAI-shaped completion without calling a provider", () => {
    const res = stubChatCompletion(
      { model: "grok-3", messages: [{ role: "user", content: "ping" }] },
      { requestId: "req-1", created: 1_700_000_000 },
    );
    expect(res).toMatchObject({
      id: "chatcmpl-req-1",
      object: "chat.completion",
      created: 1_700_000_000,
      model: "grok-3",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "[stub] received: ping" },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    });
  });
});
