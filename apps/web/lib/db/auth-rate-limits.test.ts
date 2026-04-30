import { describe, expect, it } from "vitest";

import { computeWindowStartMs, hashRateLimitKey } from "./auth-rate-limits";

describe("auth rate limit db helpers", () => {
  it("computes deterministic key hashes", () => {
    expect(hashRateLimitKey("auth:login:user@example.com")).toHaveLength(64);
    expect(hashRateLimitKey("auth:login:user@example.com")).toBe(
      hashRateLimitKey("auth:login:user@example.com"),
    );
    expect(hashRateLimitKey("a")).not.toBe(hashRateLimitKey("b"));
  });

  it("buckets timestamps by window start", () => {
    expect(computeWindowStartMs(120_000, 60_000)).toBe(120_000);
    expect(computeWindowStartMs(120_999, 60_000)).toBe(120_000);
    expect(computeWindowStartMs(179_999, 60_000)).toBe(120_000);
  });
});
