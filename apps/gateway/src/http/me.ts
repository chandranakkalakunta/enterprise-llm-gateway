import type { IdentityContext } from "../auth/types.js";

export function mePayload(identity: IdentityContext): {
  sub: string;
  email: string;
  name?: string;
  roles: IdentityContext["roles"];
  authSource: IdentityContext["authSource"];
} {
  const body: {
    sub: string;
    email: string;
    name?: string;
    roles: IdentityContext["roles"];
    authSource: IdentityContext["authSource"];
  } = {
    sub: identity.principalId,
    email: identity.email,
    roles: identity.roles,
    authSource: identity.authSource,
  };
  if (identity.name !== undefined) {
    body.name = identity.name;
  }
  return body;
}
