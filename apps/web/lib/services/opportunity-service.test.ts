import { describe, expect, it, vi } from "vitest";

import {
  getOpportunityById,
  listOpportunities,
  listOpportunityCategories,
  setOpportunity,
  setOpportunityRating,
  setOpportunitySelectionByBusinessId,
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
        findOpportunityCategoryValues: vi.fn(),
        findOpportunityById: vi.fn(),
        updateOpportunityRating: vi.fn(),
        updateOpportunity: vi.fn(),
        setOpportunitySelectionByBusinessId: vi.fn(),
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

  it("delegates listOpportunityCategories to the repository", async () => {
    const findOpportunityCategoryValues = vi
      .fn()
      .mockResolvedValue(["Cafe", "Real estate agency"]);

    const result = await listOpportunityCategories(context, {
      findOpportunities: vi.fn(),
      findOpportunityCategoryValues,
      findOpportunityById: vi.fn(),
      updateOpportunityRating: vi.fn(),
      updateOpportunity: vi.fn(),
      setOpportunitySelectionByBusinessId: vi.fn(),
    });

    expect(findOpportunityCategoryValues).toHaveBeenCalledWith(context);
    expect(result).toEqual({ categories: ["Cafe", "Real estate agency"] });
  });

  it("delegates getOpportunityById to the repository", async () => {
    const findOpportunityById = vi.fn().mockResolvedValue(null);

    const result = await getOpportunityById(
      "opportunity-1",
      context,
      {
        findOpportunities: vi.fn(),
        findOpportunityCategoryValues: vi.fn(),
        findOpportunityById,
        updateOpportunityRating: vi.fn(),
        updateOpportunity: vi.fn(),
        setOpportunitySelectionByBusinessId: vi.fn(),
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
        findOpportunityCategoryValues: vi.fn(),
        findOpportunityById: vi.fn(),
        updateOpportunityRating,
        updateOpportunity: vi.fn(),
        setOpportunitySelectionByBusinessId: vi.fn(),
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

  it("delegates setOpportunity to the repository", async () => {
    const updateOpportunity = vi.fn().mockResolvedValue({
      id: "opportunity-1",
      rating: null,
      status: "reviewed",
    });

    const result = await setOpportunity(
      "opportunity-1",
      { status: "reviewed" },
      context,
      {
        findOpportunities: vi.fn(),
        findOpportunityCategoryValues: vi.fn(),
        findOpportunityById: vi.fn(),
        updateOpportunityRating: vi.fn(),
        updateOpportunity,
        setOpportunitySelectionByBusinessId: vi.fn(),
      },
    );

    expect(updateOpportunity).toHaveBeenCalledWith(
      "opportunity-1",
      { status: "reviewed" },
      context,
    );
    expect(result).toEqual({
      id: "opportunity-1",
      rating: null,
      status: "reviewed",
    });
  });

  it("delegates setOpportunitySelectionByBusinessId to the repository", async () => {
    const updateSelection = vi.fn().mockResolvedValue({
      opportunity_id: "opportunity-1",
      business_id: "business-1",
      is_selected: true,
      updated_at: "2026-04-27T00:00:00.000Z",
    });

    const result = await setOpportunitySelectionByBusinessId(
      "business-1",
      { is_selected: true },
      context,
      {
        findOpportunities: vi.fn(),
        findOpportunityCategoryValues: vi.fn(),
        findOpportunityById: vi.fn(),
        updateOpportunityRating: vi.fn(),
        updateOpportunity: vi.fn(),
        setOpportunitySelectionByBusinessId: updateSelection,
      },
    );

    expect(updateSelection).toHaveBeenCalledWith(
      "business-1",
      { is_selected: true },
      context,
    );
    expect(result).toEqual({
      opportunity_id: "opportunity-1",
      business_id: "business-1",
      is_selected: true,
      updated_at: "2026-04-27T00:00:00.000Z",
    });
  });
});
