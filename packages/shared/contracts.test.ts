import { describe, expect, it } from "vitest";

import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  parseBusinessFilters,
  parseBusinessStatusUpdate,
  parseGooglePlacesSearchRequest,
  parseOpportunityFilters,
  parseOpportunityRatingUpdate,
  parseOpportunitySelectionUpdate,
  parseOpportunityUpdate,
  parsePaginationParams,
  parseAuthLogin,
  parseAuthProfileUpdate,
  parseAuthRegistration,
  parseUserRoleUpdate,
  parseSearchCreate,
  parseSearchFilters,
  USER_ROLES,
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

  it("parses business filters used by the dashboard and rejects unsupported order fields", () => {
    const result = parseBusinessFilters({
      page: "2",
      page_size: "999",
      has_website: "false",
      status: "reviewed",
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
        status: "reviewed",
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

  it("parses optional search_run_id as UUID and rejects invalid values", () => {
    const id = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
    const ok = parseBusinessFilters({ page: "1", page_size: "20", search_run_id: id });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.value.search_run_id).toBe(id);
    }

    expect(parseBusinessFilters({ search_run_id: "not-a-uuid" }).ok).toBe(false);
    expect(parseBusinessFilters({ search_run_id: 123 as unknown as string }).ok).toBe(
      false,
    );
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

  it("parses opportunity updates for rating, status, and notes changes", () => {
    expect(parseOpportunityUpdate({ rating: 4 })).toEqual({
      ok: true,
      value: { rating: 4 },
    });
    expect(parseOpportunityUpdate({ rating: null, status: "reviewed" })).toEqual({
      ok: true,
      value: { rating: null, status: "reviewed" },
    });
    expect(parseOpportunityUpdate({ status: "contacted" })).toEqual({
      ok: true,
      value: { status: "contacted" },
    });
    expect(parseOpportunityUpdate({ notes: "Call back next week" })).toEqual({
      ok: true,
      value: { notes: "Call back next week" },
    });
    expect(parseOpportunityUpdate({ notes: null })).toEqual({
      ok: true,
      value: { notes: null },
    });
  });

  it("rejects invalid opportunity update payloads", () => {
    expect(parseOpportunityUpdate({})).toEqual({
      ok: false,
      errors: ["at least one of rating, status, or notes is required"],
    });
    expect(parseOpportunityUpdate({ rating: 6 }).ok).toBe(false);
    expect(parseOpportunityUpdate({ status: "archived" }).ok).toBe(false);
  });

  it("parses and validates manual opportunity selection payloads", () => {
    expect(parseOpportunitySelectionUpdate({ is_selected: true })).toEqual({
      ok: true,
      value: { is_selected: true },
    });
    expect(parseOpportunitySelectionUpdate({ is_selected: false })).toEqual({
      ok: true,
      value: { is_selected: false },
    });
    expect(parseOpportunitySelectionUpdate({})).toEqual({
      ok: false,
      errors: ["is_selected is required"],
    });
    expect(parseOpportunitySelectionUpdate({ is_selected: "true" })).toEqual({
      ok: false,
      errors: ["is_selected must be true or false"],
    });
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

  it("defines the supported auth roles", () => {
    expect(USER_ROLES).toEqual(["admin", "user"]);
  });

  it("parses auth registration input with normalized identity fields", () => {
    const result = parseAuthRegistration({
      username: " DemoUser ",
      firstName: " Gael ",
      lastName: " Dev ",
      phone: " +54 11 5555 1234 ",
      email: " GAEL@example.COM ",
      password: "super-secret-123",
    });

    expect(result).toEqual({
      ok: true,
      value: {
        username: "demouser",
        firstName: "Gael",
        lastName: "Dev",
        phone: "+54 11 5555 1234",
        email: "gael@example.com",
        password: "super-secret-123",
      },
    });
  });

  it("rejects weak auth registration payloads", () => {
    const result = parseAuthRegistration({
      username: "a",
      firstName: "",
      lastName: "",
      phone: "",
      email: "not-email",
      password: "short",
    });

    expect(result).toEqual({
      ok: false,
      errors: expect.arrayContaining([
        "username must be between 3 and 32 characters",
        "firstName is required",
        "lastName is required",
        "email must be a valid email address",
        "password must be at least 12 characters",
      ]),
    });
  });

  it("parses login, profile update, and role update payloads", () => {
    expect(
      parseAuthLogin({
        emailOrUsername: " Admin@Example.com ",
        password: "super-secret-123",
      })
    ).toEqual({
      ok: true,
      value: {
        emailOrUsername: "admin@example.com",
        password: "super-secret-123",
      },
    });

    expect(
      parseAuthProfileUpdate({
        firstName: " Ada ",
        lastName: " Lovelace ",
        phone: null,
        email: " ADA@example.com ",
      })
    ).toEqual({
      ok: true,
      value: {
        firstName: "Ada",
        lastName: "Lovelace",
        phone: null,
        email: "ada@example.com",
      },
    });

    expect(parseUserRoleUpdate({ role: "admin" })).toEqual({
      ok: true,
      value: { role: "admin" },
    });
    expect(parseUserRoleUpdate({ role: "owner" }).ok).toBe(false);
  });
});
