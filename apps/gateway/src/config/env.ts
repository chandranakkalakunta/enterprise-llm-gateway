import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  OIDC_ISSUER: z.string().url().default("https://accounts.google.com"),
  OIDC_CLIENT_ID: z.string().default(""),
  OIDC_CLIENT_SECRET: z.string().default(""),
  OIDC_AUDIENCE: z.string().default(""),
  OIDC_REDIRECT_URI: z.string().default("http://localhost:8080/auth/callback"),
  ADMIN_EMAILS: z.string().default("admin@chandraailabs.com"),
  GROK_API_KEY: z.string().default(""),
  GROK_BASE_URL: z.string().url().default("https://api.x.ai/v1"),
  GROK_DEFAULT_MODEL: z.string().min(1).default("grok-4.5"),
  GROK_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300_000).default(60_000),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const parsed = envSchema.parse(source);
  if (parsed.OIDC_AUDIENCE.length === 0 && parsed.OIDC_CLIENT_ID.length > 0) {
    return { ...parsed, OIDC_AUDIENCE: parsed.OIDC_CLIENT_ID };
  }
  return parsed;
}

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  return parseEnv(source);
}

export function oidcConfigured(env: Env): boolean {
  return env.OIDC_CLIENT_ID.length > 0 && env.OIDC_CLIENT_SECRET.length > 0;
}

export function grokConfigured(env: Env): boolean {
  return env.GROK_API_KEY.length > 0;
}
