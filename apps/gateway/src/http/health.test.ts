import { describe, expect, it } from "vitest";
import { healthPayload } from "./health.js";

describe("healthPayload", () => {
  it("returns ok for the gateway service", () => {
    expect(healthPayload()).toEqual({ status: "ok", service: "gateway" });
  });
});
