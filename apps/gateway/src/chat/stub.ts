import { lastUserContent, type ChatCompletionRequest } from "./schema.js";

export type ChatCompletionChoice = {
  index: number;
  message: { role: "assistant"; content: string };
  finish_reason: "stop";
};

export type ChatCompletionResponse = {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export function stubChatCompletion(
  request: ChatCompletionRequest,
  opts: { requestId: string; created?: number },
): ChatCompletionResponse {
  const last = lastUserContent(request.messages);
  const content =
    last === undefined
      ? "[stub] no user message; no provider was called."
      : `[stub] received: ${last}`;

  return {
    id: `chatcmpl-${opts.requestId}`,
    object: "chat.completion",
    created: opts.created ?? Math.floor(Date.now() / 1000),
    model: request.model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: "stop",
      },
    ],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    },
  };
}
