import type { GatewayRole, IdentityContext, IdTokenClaims } from "./types.js";

export function parseAdminEmails(raw: string): string[] {
  return raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);
}

export function rolesForEmail(email: string, adminEmails: readonly string[]): GatewayRole[] {
  const normalized = email.trim().toLowerCase();
  if (adminEmails.includes(normalized)) {
    return ["admin"];
  }
  return ["user"];
}

export function identityFromClaims(
  claims: IdTokenClaims,
  adminEmails: readonly string[],
): IdentityContext {
  const email = claims.email.trim();
  const identity: IdentityContext = {
    principalId: claims.sub,
    email,
    roles: rolesForEmail(email, adminEmails),
    authSource: "google_oidc",
  };
  if (claims.name !== undefined && claims.name.length > 0) {
    identity.name = claims.name;
  }
  return identity;
}
