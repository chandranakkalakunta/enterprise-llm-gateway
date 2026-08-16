import { describe, expect, it } from "vitest";
import { buildAuthorizationUrl, generateState, statesEqual } from "./oauth.js";

describe("oauth helpers", () => {
  it("generates unique states", () => {
    expect(generateState()).not.toBe(generateState());
    expect(generateState().length).toBe(64);
  });

  it("compares states in constant time", () => {
    const state = generateState();
    expect(statesEqual(state, state)).toBe(true);
    expect(statesEqual(state, generateState())).toBe(false);
    expect(statesEqual("abc", "ab")).toBe(false);
  });

  it("builds a Google authorization URL", () => {
    const url = new URL(
      buildAuthorizationUrl({
        clientId: "test-client-id",
        redirectUri: "http://localhost:8080/auth/callback",
        state: "state-1",
        nonce: "nonce-1",
      }),
    );
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("test-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:8080/auth/callback");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("state")).toBe("state-1");
    expect(url.searchParams.get("nonce")).toBe("nonce-1");
  });
});
