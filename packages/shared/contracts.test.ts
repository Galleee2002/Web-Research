import { describe, expect, it } from "vitest";

import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  parseBusinessStatusUpdate,
  parseGooglePlacesSearchRequest,
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

  it("accepts a valid google places request after trimming text inputs", () => {
    const result = parseGooglePlacesSearchRequest({
      query: " pizzerias ",
      location: " Miami, FL ",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({
        query: "pizzerias",
        location: "Miami, FL",
      });
    }
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
});
