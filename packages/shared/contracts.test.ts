import { describe, expect, it } from "vitest";

import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  parseBusinessStatusUpdate,
  parseOpportunityFilters,
  parseOpportunityRatingUpdate,
  parsePaginationParams,
  parseSearchCreate,
} from "./index";

describe("shared contracts", () => {
  it("accepts a valid search request after trimming text inputs", () => {
    const result = parseSearchCreate({
      query: " dentistas ",
      location: " Buenos Aires, Argentina ",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        query: "dentistas",
        location: "Buenos Aires, Argentina",
      });
    }
  });

  it("rejects empty search request fields", () => {
    const result = parseSearchCreate({
      query: " ",
      location: "Buenos Aires, Argentina",
    });

    expect(result.ok).toBe(false);
  });

  it("caps page size at the documented maximum", () => {
    const result = parsePaginationParams({
      page: "2",
      page_size: "999",
    });

    expect(result).toEqual({
      page: 2,
      page_size: MAX_PAGE_SIZE,
    });
    expect(DEFAULT_PAGE_SIZE).toBe(20);
    expect(MAX_PAGE_SIZE).toBe(100);
  });

  it("validates business status updates and preserves nullable notes", () => {
    const result = parseBusinessStatusUpdate({
      status: "reviewed",
      notes: null,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        status: "reviewed",
        notes: null,
      });
    }

    expect(parseBusinessStatusUpdate({ status: "archived" }).ok).toBe(false);
  });

  it("accepts valid opportunity rating updates and allows clearing the rating", () => {
    expect(parseOpportunityRatingUpdate({ rating: 1 })).toEqual({
      ok: true,
      value: { rating: 1 },
    });
    expect(parseOpportunityRatingUpdate({ rating: 5 })).toEqual({
      ok: true,
      value: { rating: 5 },
    });
    expect(parseOpportunityRatingUpdate({ rating: null })).toEqual({
      ok: true,
      value: { rating: null },
    });
  });

  it("rejects invalid opportunity rating payloads", () => {
    expect(parseOpportunityRatingUpdate({})).toEqual({
      ok: false,
      errors: ["rating is required"],
    });
    expect(parseOpportunityRatingUpdate({ rating: 0 }).ok).toBe(false);
    expect(parseOpportunityRatingUpdate({ rating: 6 }).ok).toBe(false);
    expect(parseOpportunityRatingUpdate({ rating: 3.5 }).ok).toBe(false);
    expect(parseOpportunityRatingUpdate({ rating: "5" }).ok).toBe(false);
  });

  it("parses opportunity filters and accepts rating ordering", () => {
    const result = parseOpportunityFilters({
      page: "2",
      page_size: "10",
      status: "reviewed",
      city: " Buenos Aires ",
      category: " Dentist ",
      query: " clinic ",
      order_by: "rating",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        page: 2,
        page_size: 10,
        status: "reviewed",
        city: "Buenos Aires",
        category: "Dentist",
        query: "clinic",
        order_by: "rating",
      },
    });
  });

  it("rejects invalid opportunity ordering", () => {
    const result = parseOpportunityFilters({ order_by: "invalid" });

    expect(result).toEqual({
      ok: false,
      errors: ["order_by must be rating, created_at, name, or city"],
    });
  });
});
