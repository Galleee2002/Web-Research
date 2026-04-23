import { describe, expect, it } from "vitest";

import { findBusinessById, findBusinesses } from "./businesses";

describe.skipIf(!process.env.DATABASE_URL)("database integration", () => {
  const context = {
    correlationId: "integration-test",
    method: "GET",
    route: "/integration-test"
  } as const;

  it("lists businesses through the repository contract", async () => {
    const result = await findBusinesses({
      page: 1,
      page_size: 20,
      order_by: "created_at"
    }, context);

    expect(Array.isArray(result.items)).toBe(true);
    expect(result.page).toBe(1);
    expect(result.page_size).toBe(20);
    expect(result.total).toBeGreaterThanOrEqual(0);
  });

  it("returns null for a missing business id", async () => {
    const business = await findBusinessById(
      "00000000-0000-4000-8000-000000000000",
      context
    );

    expect(business).toBeNull();
  });
});
