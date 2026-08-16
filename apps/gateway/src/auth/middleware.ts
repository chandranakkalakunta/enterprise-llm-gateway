import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { identityFromClaims } from "./roles.js";
import { ID_TOKEN_COOKIE } from "./oauth.js";
import type { IdentityContext, VerifyIdToken } from "./types.js";

export type AuthEnv = {
  Variables: {
    identity: IdentityContext;
  };
};

export function extractBearerToken(authorization: string | undefined): string | undefined {
  if (authorization === undefined) {
    return undefined;
  }
  const match = /^Bearer\s+(\S+)$/i.exec(authorization.trim());
  return match?.[1];
}

export function requireAuth(opts: {
  adminEmails: readonly string[];
  verifyIdToken: VerifyIdToken;
}): MiddlewareHandler<AuthEnv> {
  return async (c, next) => {
    const token =
      extractBearerToken(c.req.header("authorization")) ?? getCookie(c, ID_TOKEN_COOKIE);

    if (token === undefined || token.length === 0) {
      return c.json({ error: "unauthorized", message: "missing credentials" }, 401);
    }

    try {
      const claims = await opts.verifyIdToken(token);
      c.set("identity", identityFromClaims(claims, opts.adminEmails));
      await next();
      return;
    } catch {
      return c.json({ error: "unauthorized", message: "invalid token" }, 401);
    }
  };
}
