import { describe, expect, it } from "vitest";
import { createCounters } from "./counters.js";

describe("createCounters", () => {
  it("increments request and status buckets", () => {
    const counters = createCounters();
    counters.recordHttp(200);
    counters.recordHttp(401);
    counters.recordHttp(503);
    counters.recordProviderError();
    expect(counters.snapshot()).toEqual({
      requests_total: 3,
      http_4xx: 1,
      http_5xx: 1,
      provider_errors: 1,
    });
  });
});
