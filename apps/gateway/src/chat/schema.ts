import { z } from "zod";

export const chatMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().min(1),
});

export const chatCompletionRequestSchema = z.object({
  model: z.string().min(1).optional(),
  messages: z.array(chatMessageSchema).min(1),
  stream: z.boolean().optional(),
});

export type ChatCompletionRequest = z.infer<typeof chatCompletionRequestSchema>;

export function lastUserContent(messages: ChatCompletionRequest["messages"]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.role === "user") {
      return message.content;
    }
  }
  return undefined;
}
