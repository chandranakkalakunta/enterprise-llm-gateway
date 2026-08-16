import { createRemoteJWKSet, jwtVerify } from "jose";
import type { IdTokenClaims, VerifyIdToken } from "./types.js";

const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";

export function createGoogleIdTokenVerifier(opts: {
  issuer: string;
  audience: string;
}): VerifyIdToken {
  const jwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));
  const issuers = Array.from(
    new Set([opts.issuer, "https://accounts.google.com", "accounts.google.com"]),
  );

  return async (token: string): Promise<IdTokenClaims> => {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: issuers,
      audience: opts.audience,
    });

    const sub = payload.sub;
    const email = payload.email;
    if (typeof sub !== "string" || sub.length === 0) {
      throw new Error("id_token missing sub");
    }
    if (typeof email !== "string" || email.length === 0) {
      throw new Error("id_token missing email");
    }
    if (payload.email_verified === false) {
      throw new Error("email is not verified");
    }

    const claims: IdTokenClaims = { sub, email };
    if (typeof payload.name === "string" && payload.name.length > 0) {
      claims.name = payload.name;
    }
    if (typeof payload.email_verified === "boolean") {
      claims.email_verified = payload.email_verified;
    }
    return claims;
  };
}
