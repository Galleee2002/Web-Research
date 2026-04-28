import { describe, it, expect } from "vitest";
import { DEFAULT_PAGE_SIZE, parseScanFilters } from "@shared/index";

describe("parseScanFilters", () => {
  it("should parse valid scan filters with default pagination", () => {
    const result = parseScanFilters({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.page).toBe(1);
      expect(result.value.page_size).toBe(DEFAULT_PAGE_SIZE);
      expect(result.value.provider).toBeUndefined();
      expect(result.value.status).toBeUndefined();
      expect(result.value.from).toBeUndefined();
      expect(result.value.to).toBeUndefined();
      expect(result.value.started_at_order).toBeUndefined();
    }
  });

  it("should parse valid scan filters with provider filter", () => {
    const result = parseScanFilters({
      page: 1,
      page_size: 20,
      provider: "google_places",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.provider).toBe("google_places");
      expect(result.value.page_size).toBe(20);
    }
  });

  it("should parse valid scan filters with status filter", () => {
    const result = parseScanFilters({
      page: 1,
      page_size: 10,
      status: "completed",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("completed");
    }
  });

  it("should parse valid scan filters with date range", () => {
    const result = parseScanFilters({
      page: 1,
      page_size: 10,
      from: "2026-01-01T00:00:00Z",
      to: "2026-12-31T23:59:59Z",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.from).toBe("2026-01-01T00:00:00Z");
      expect(result.value.to).toBe("2026-12-31T23:59:59Z");
    }
  });

  it("should reject invalid status", () => {
    const result = parseScanFilters({
      page: 1,
      page_size: 10,
      status: "invalid_status",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("status"))).toBe(true);
    }
  });

  it("should reject page_size exceeding MAX_PAGE_SIZE", () => {
    const result = parseScanFilters({
      page: 1,
      page_size: 500,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.page_size).toBeLessThanOrEqual(100);
    }
  });

  it("parses started_at_order asc and desc and rejects invalid", () => {
    const asc = parseScanFilters({ started_at_order: "asc" });
    expect(asc.ok).toBe(true);
    if (asc.ok) expect(asc.value.started_at_order).toBe("asc");

    const desc = parseScanFilters({ started_at_order: "desc" });
    expect(desc.ok).toBe(true);
    if (desc.ok) expect(desc.value.started_at_order).toBe("desc");

    expect(parseScanFilters({ started_at_order: "sideways" }).ok).toBe(false);
  });

  it("should reject invalid page", () => {
    const result = parseScanFilters({
      page: 0,
      page_size: 10,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("page"))).toBe(true);
    }
  });
});
