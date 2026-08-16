import type { Logger } from "../obs/logger.js";
import { type ChatCompletionResponse, type CompleteChat, ProviderError } from "./types.js";

export type GrokAdapterConfig = {
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
  timeoutMs: number;
  fetchFn?: typeof fetch;
  log?: Logger;
};

type UpstreamCompletion = {
  id?: string;
  created?: number;
  model?: string;
  choices?: Array<{
    index?: number;
    message?: { role?: string; content?: unknown };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

export function createGrokCompleter(config: GrokAdapterConfig): CompleteChat {
  const fetchFn = config.fetchFn ?? fetch;
  const baseUrl = config.baseUrl.replace(/\/$/, "");

  return async (request, opts) => {
    const model = request.model ?? config.defaultModel;
    const url = `${baseUrl}/chat/completions`;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, config.timeoutMs);
    const started = Date.now();

    const emit = (ok: boolean, errorCode?: string): void => {
      config.log?.info({
        msg: "provider_complete",
        provider: "grok",
        model,
        latency_ms: Date.now() - started,
        ok,
        request_id: opts.requestId,
        ...(errorCode !== undefined ? { error_code: errorCode } : {}),
      });
    };

    let res: Response;
    try {
      res = await fetchFn(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: request.messages,
          stream: false,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      if (isAbortError(err)) {
        emit(false, "provider_timeout");
        throw new ProviderError(504, "provider_timeout", "Grok request timed out");
      }
      emit(false, "provider_unreachable");
      throw new ProviderError(502, "provider_unreachable", "Grok request failed");
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const code = mapUpstreamCode(res.status);
      emit(false, code);
      throw new ProviderError(502, code, `Grok upstream returned ${res.status}`);
    }

    let payload: unknown;
    try {
      payload = await res.json();
    } catch {
      emit(false, "provider_invalid_response");
      throw new ProviderError(502, "provider_invalid_response", "Grok response was not JSON");
    }

    const completion = normalizeCompletion(payload, { requestId: opts.requestId, model });
    emit(true);
    return completion;
  };
}

function mapUpstreamCode(status: number): string {
  if (status === 401 || status === 403) {
    return "provider_auth_failed";
  }
  if (status === 429) {
    return "provider_rate_limited";
  }
  return "provider_error";
}

function isAbortError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "name" in err &&
    (err.name === "AbortError" || err.name === "TimeoutError")
  );
}

function normalizeCompletion(
  payload: unknown,
  opts: { requestId: string; model: string },
): ChatCompletionResponse {
  if (typeof payload !== "object" || payload === null) {
    throw new ProviderError(502, "provider_invalid_response", "Grok response missing body");
  }
  const raw = payload as UpstreamCompletion;
  const first = raw.choices?.[0];
  const content = first?.message?.content;
  if (first === undefined || typeof content !== "string" || content.length === 0) {
    throw new ProviderError(
      502,
      "provider_invalid_response",
      "Grok response missing assistant content",
    );
  }

  return {
    id: typeof raw.id === "string" && raw.id.length > 0 ? raw.id : `chatcmpl-${opts.requestId}`,
    object: "chat.completion",
    created: typeof raw.created === "number" ? raw.created : Math.floor(Date.now() / 1000),
    model: typeof raw.model === "string" && raw.model.length > 0 ? raw.model : opts.model,
    choices: [
      {
        index: first.index ?? 0,
        message: { role: "assistant", content },
        finish_reason: first.finish_reason ?? "stop",
      },
    ],
    usage: {
      prompt_tokens: raw.usage?.prompt_tokens ?? 0,
      completion_tokens: raw.usage?.completion_tokens ?? 0,
      total_tokens: raw.usage?.total_tokens ?? 0,
    },
  };
}
