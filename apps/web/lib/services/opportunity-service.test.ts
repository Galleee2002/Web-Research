import { describe, expect, it, vi } from "vitest";

import {
  getOpportunityById,
  listOpportunities,
  setOpportunityRating,
} from "./opportunity-service";

describe("opportunity service", () => {
  const context = {
    correlationId: "corr-1",
    method: "GET",
    route: "/api/opportunities",
  } as const;

  it("delegates listOpportunities to the repository", async () => {
    const findOpportunities = vi.fn().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 20,
    });

    const result = await listOpportunities(
      {
        page: 1,
        page_size: 20,
        order_by: "rating",
      },
      context,
      {
        findOpportunities,
        findOpportunityById: vi.fn(),
        updateOpportunityRating: vi.fn(),
      },
    );

    expect(findOpportunities).toHaveBeenCalledWith(
      {
        page: 1,
        page_size: 20,
        order_by: "rating",
      },
      context,
    );
    expect(result).toEqual({
      items: [],
      total: 0,
      page: 1,
      page_size: 20,
    });
  });

  it("delegates getOpportunityById to the repository", async () => {
    const findOpportunityById = vi.fn().mockResolvedValue(null);

    const result = await getOpportunityById(
      "opportunity-1",
      context,
      {
        findOpportunities: vi.fn(),
        findOpportunityById,
        updateOpportunityRating: vi.fn(),
      },
    );

    expect(findOpportunityById).toHaveBeenCalledWith("opportunity-1", context);
    expect(result).toBeNull();
  });

  it("delegates setOpportunityRating to the repository", async () => {
    const updateOpportunityRating = vi.fn().mockResolvedValue({
      id: "opportunity-1",
      rating: 4,
    });

    const result = await setOpportunityRating(
      "opportunity-1",
      { rating: 4 },
      context,
      {
        findOpportunities: vi.fn(),
        findOpportunityById: vi.fn(),
        updateOpportunityRating,
      },
    );

    expect(updateOpportunityRating).toHaveBeenCalledWith(
      "opportunity-1",
      { rating: 4 },
      context,
    );
    expect(result).toEqual({
      id: "opportunity-1",
      rating: 4,
    });
  });
});
