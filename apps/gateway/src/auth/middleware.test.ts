import { describe, expect, it } from "vitest";
import { extractBearerToken } from "./middleware.js";

describe("extractBearerToken", () => {
  it("reads a Bearer token", () => {
    expect(extractBearerToken("Bearer abc.def")).toBe("abc.def");
  });

  it("returns undefined when the header is missing or malformed", () => {
    expect(extractBearerToken(undefined)).toBeUndefined();
    expect(extractBearerToken("Basic abc")).toBeUndefined();
    expect(extractBearerToken("Bearer")).toBeUndefined();
  });
});
