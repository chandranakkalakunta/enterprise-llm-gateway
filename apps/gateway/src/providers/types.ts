import type { ChatCompletionRequest } from "../chat/schema.js";

export type ChatCompletionChoice = {
  index: number;
  message: { role: "assistant"; content: string };
  finish_reason: string;
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

export type CompleteChat = (
  request: ChatCompletionRequest,
  opts: { requestId: string },
) => Promise<ChatCompletionResponse>;

export class ProviderError extends Error {
  readonly status: 502 | 504;
  readonly code: string;

  constructor(status: 502 | 504, code: string, message: string) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
    this.code = code;
  }
}
