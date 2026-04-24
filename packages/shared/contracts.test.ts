import { describe, expect, it } from "vitest";

import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  parseBusinessFilters,
  parseBusinessStatusUpdate,
  parsePaginationParams,
  parseSearchCreate,
  parseSearchFilters,
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
      status: "opportunities",
      notes: null,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        status: "opportunities",
        notes: null,
      });
    }

    expect(parseBusinessStatusUpdate({ status: "archived" }).ok).toBe(false);
  });

  it("parses business filters used by the dashboard and rejects unsupported order fields", () => {
    const result = parseBusinessFilters({
      page: "2",
      page_size: "999",
      has_website: "false",
      status: "opportunities",
      city: " Buenos Aires ",
      category: " Dentist ",
      query: " centro ",
      order_by: "city",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        page: 2,
        page_size: MAX_PAGE_SIZE,
        has_website: false,
        status: "opportunities",
        city: "Buenos Aires",
        category: "Dentist",
        query: "centro",
        order_by: "city",
      });
    }

    expect(parseBusinessFilters({ order_by: "category" }).ok).toBe(false);
    expect(parseBusinessFilters({ has_website: "maybe" }).ok).toBe(false);
    expect(parseBusinessFilters({ page: "0" }).ok).toBe(false);
    expect(parseBusinessFilters({ page_size: "abc" }).ok).toBe(false);
  });

  it("parses search filters with source default and rejects invalid status", () => {
    const result = parseSearchFilters({
      page: "3",
      page_size: "5",
      status: "completed",
      source: "google_places",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        page: 3,
        page_size: 5,
        status: "completed",
        source: "google_places",
      });
    }

    expect(parseSearchFilters({ status: "archived" }).ok).toBe(false);
  });
});
