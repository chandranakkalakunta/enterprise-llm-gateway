export type GatewayRole = "admin" | "user";

export type IdentityContext = {
  principalId: string;
  email: string;
  name?: string;
  roles: GatewayRole[];
  authSource: "google_oidc";
};

export type IdTokenClaims = {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
};

export type VerifyIdToken = (token: string) => Promise<IdTokenClaims>;
