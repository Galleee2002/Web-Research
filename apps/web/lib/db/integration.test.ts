import { describe, expect, it } from "vitest";

import { findBusinessById, findBusinesses } from "./businesses";
import {
  findOpportunityById,
  findOpportunities,
  updateOpportunityRating,
} from "./opportunities";

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

  it("lists seeded opportunities sorted by rating", async () => {
    const result = await findOpportunities(
      {
        page: 1,
        page_size: 20,
        order_by: "rating",
      },
      context,
    );

    expect(Array.isArray(result.items)).toBe(true);
    expect(result.items.every((item) => item.has_website === false)).toBe(true);
    expect(result.page).toBe(1);
  });

  it("updates and clears an opportunity rating", async () => {
    const list = await findOpportunities(
      {
        page: 1,
        page_size: 1,
        order_by: "rating",
      },
      context,
    );
    const firstOpportunity = list.items[0];

    expect(firstOpportunity).toBeDefined();

    const opportunity = await findOpportunityById(firstOpportunity.id, context);

    expect(opportunity).not.toBeNull();
    if (!opportunity) {
      throw new Error("Expected a seeded opportunity to exist");
    }

    const updated = await updateOpportunityRating(
      opportunity.id,
      { rating: 3 },
      context,
    );

    expect(updated?.rating).toBe(3);

    const cleared = await updateOpportunityRating(
      opportunity.id,
      { rating: null },
      context,
    );

    expect(cleared?.rating).toBeNull();
  });
});
