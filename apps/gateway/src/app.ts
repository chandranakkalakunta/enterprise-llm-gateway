import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { AuthEnv } from "./auth/middleware.js";
import { requireAuth } from "./auth/middleware.js";
import {
  buildAuthorizationUrl,
  exchangeAuthorizationCode,
  generateState,
  ID_TOKEN_COOKIE,
  STATE_COOKIE,
  statesEqual,
} from "./auth/oauth.js";
import { parseAdminEmails } from "./auth/roles.js";
import type { VerifyIdToken } from "./auth/types.js";
import { createGoogleIdTokenVerifier } from "./auth/verify.js";
import { type Env, oidcConfigured, parseEnv } from "./config/env.js";
import { healthPayload } from "./http/health.js";
import { mePayload } from "./http/me.js";

export type CreateAppOptions = {
  env?: Env;
  verifyIdToken?: VerifyIdToken;
};

export function createApp(options: CreateAppOptions = {}): Hono<AuthEnv> {
  const env = options.env ?? parseEnv({ NODE_ENV: "test" });
  const adminEmails = parseAdminEmails(env.ADMIN_EMAILS);
  const audience = env.OIDC_AUDIENCE.length > 0 ? env.OIDC_AUDIENCE : env.OIDC_CLIENT_ID;
  const verifyIdToken =
    options.verifyIdToken ??
    createGoogleIdTokenVerifier({
      issuer: env.OIDC_ISSUER,
      audience: audience.length > 0 ? audience : "unconfigured",
    });
  const cookieSecure = env.NODE_ENV === "production";

  const app = new Hono<AuthEnv>();

  app.get("/health", (c) => c.json(healthPayload(), 200));

  app.get("/auth/login", (c) => {
    if (!oidcConfigured(env)) {
      return c.json({ error: "oidc_not_configured" }, 503);
    }
    const state = generateState();
    const nonce = generateState();
    setCookie(c, STATE_COOKIE, `${state}.${nonce}`, {
      httpOnly: true,
      sameSite: "Lax",
      secure: cookieSecure,
      path: "/",
      maxAge: 600,
    });
    const location = buildAuthorizationUrl({
      clientId: env.OIDC_CLIENT_ID,
      redirectUri: env.OIDC_REDIRECT_URI,
      state,
      nonce,
    });
    return c.redirect(location, 302);
  });

  app.get("/auth/callback", async (c) => {
    if (!oidcConfigured(env)) {
      return c.json({ error: "oidc_not_configured" }, 503);
    }

    const errorParam = c.req.query("error");
    if (errorParam !== undefined) {
      return c.json({ error: "oidc_denied", message: errorParam }, 401);
    }

    const code = c.req.query("code");
    const state = c.req.query("state");
    const stateCookie = getCookie(c, STATE_COOKIE);
    if (code === undefined || state === undefined || stateCookie === undefined) {
      return c.json({ error: "unauthorized", message: "missing state or code" }, 401);
    }

    const [expectedState] = stateCookie.split(".");
    if (expectedState === undefined || !statesEqual(expectedState, state)) {
      return c.json({ error: "unauthorized", message: "state mismatch" }, 401);
    }

    try {
      const tokens = await exchangeAuthorizationCode({
        clientId: env.OIDC_CLIENT_ID,
        clientSecret: env.OIDC_CLIENT_SECRET,
        redirectUri: env.OIDC_REDIRECT_URI,
        code,
      });
      if (tokens.id_token === undefined || tokens.id_token.length === 0) {
        return c.json({ error: "unauthorized", message: "no id_token" }, 401);
      }
      await verifyIdToken(tokens.id_token);
      deleteCookie(c, STATE_COOKIE, { path: "/" });
      setCookie(c, ID_TOKEN_COOKIE, tokens.id_token, {
        httpOnly: true,
        sameSite: "Lax",
        secure: cookieSecure,
        path: "/",
        maxAge: 3600,
      });
      return c.redirect("/v1/me", 302);
    } catch {
      return c.json({ error: "unauthorized", message: "token exchange failed" }, 401);
    }
  });

  app.get("/auth/logout", (c) => {
    deleteCookie(c, ID_TOKEN_COOKIE, { path: "/" });
    deleteCookie(c, STATE_COOKIE, { path: "/" });
    return c.json({ status: "signed_out" }, 200);
  });

  app.get("/v1/me", requireAuth({ adminEmails, verifyIdToken }), (c) => {
    return c.json(mePayload(c.get("identity")), 200);
  });

  return app;
}
