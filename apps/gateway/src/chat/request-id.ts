import { randomUUID } from "node:crypto";

export function resolveRequestId(headerValue: string | undefined): string {
  if (headerValue === undefined) {
    return randomUUID();
  }
  const trimmed = headerValue.trim();
  return trimmed.length > 0 ? trimmed : randomUUID();
}
