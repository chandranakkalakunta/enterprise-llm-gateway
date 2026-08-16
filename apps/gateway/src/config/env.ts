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
