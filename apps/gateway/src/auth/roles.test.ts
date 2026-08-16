import { describe, expect, it } from "vitest";
import { identityFromClaims, parseAdminEmails, rolesForEmail } from "./roles.js";

describe("parseAdminEmails", () => {
  it("splits, trims, and lowercases", () => {
    expect(parseAdminEmails("  Admin@Example.com, other@x.dev ")).toEqual([
      "admin@example.com",
      "other@x.dev",
    ]);
  });
});

describe("rolesForEmail", () => {
  const admins = ["admin@chandraailabs.com"];

  it("maps allow-listed email to admin", () => {
    expect(rolesForEmail("Admin@ChandraAiLabs.com", admins)).toEqual(["admin"]);
  });

  it("maps everyone else to user", () => {
    expect(rolesForEmail("dev@example.com", admins)).toEqual(["user"]);
  });
});

describe("identityFromClaims", () => {
  it("builds internal request context", () => {
    expect(
      identityFromClaims({ sub: "google-sub-1", email: "admin@chandraailabs.com", name: "Admin" }, [
        "admin@chandraailabs.com",
      ]),
    ).toEqual({
      principalId: "google-sub-1",
      email: "admin@chandraailabs.com",
      name: "Admin",
      roles: ["admin"],
      authSource: "google_oidc",
    });
  });
});
