export type LogLevel = "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

export type Logger = {
  info: (fields: LogFields) => void;
  warn: (fields: LogFields) => void;
  error: (fields: LogFields) => void;
};

const REDACTED = "[redacted]";

const FORBIDDEN_KEYS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "prompt",
  "prompts",
  "messages",
  "content",
  "completion",
  "completions",
  "api_key",
  "apikey",
  "api-key",
  "grok_api_key",
  "oidc_client_secret",
  "client_secret",
  "id_token",
  "access_token",
  "refresh_token",
  "password",
  "secret",
]);

export function redactValue(value: unknown): unknown {
  if (typeof value === "string") {
    if (/^bearer\s+\S+/i.test(value) || /^basic\s+\S+/i.test(value)) {
      return REDACTED;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(key.toLowerCase())) {
        out[key] = REDACTED;
      } else {
        out[key] = redactValue(inner);
      }
    }
    return out;
  }
  return value;
}

export function requestLogShape(fields: {
  method: string;
  path: string;
  status: number;
  duration_ms: number;
  request_id: string;
  principal_id: string;
}): LogFields {
  return {
    msg: "http_request",
    method: fields.method,
    path: fields.path,
    status: fields.status,
    duration_ms: fields.duration_ms,
    request_id: fields.request_id,
    principal_id: fields.principal_id,
  };
}

export function createLogger(write: (line: string) => void = defaultWrite): Logger {
  const emit = (level: LogLevel, fields: LogFields): void => {
    const safe = redactValue(fields) as LogFields;
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      ...safe,
    });
    write(`${line}\n`);
  };

  return {
    info: (fields) => {
      emit("info", fields);
    },
    warn: (fields) => {
      emit("warn", fields);
    },
    error: (fields) => {
      emit("error", fields);
    },
  };
}

function defaultWrite(line: string): void {
  process.stdout.write(line);
}
