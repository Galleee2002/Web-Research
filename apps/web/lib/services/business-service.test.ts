import { describe, expect, it, vi } from "vitest";

import {
  getBusinessById,
  listBusinesses,
  listBusinessesForExport,
  updateBusinessStatus
} from "./business-service";

describe("business service", () => {
  it("delegates listBusinesses to the repository", async () => {
    const findBusinesses = vi.fn().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 20
    });

    const result = await listBusinesses(
      {
        page: 1,
        page_size: 20,
        order_by: "created_at"
      },
      {
        findBusinesses,
        findBusinessesForExport: vi.fn(),
        findBusinessById: vi.fn(),
        updateBusinessLeadStatus: vi.fn()
      }
    );

    expect(findBusinesses).toHaveBeenCalledWith({
      page: 1,
      page_size: 20,
      order_by: "created_at"
    });
    expect(result).toEqual({
      items: [],
      total: 0,
      page: 1,
      page_size: 20
    });
  });

  it("delegates listBusinessesForExport to the repository", async () => {
    const findBusinessesForExport = vi.fn().mockResolvedValue([
      {
        id: "business-1"
      }
    ]);

    const result = await listBusinessesForExport(
      {
        page: 1,
        page_size: 20
      },
      {
        findBusinesses: vi.fn(),
        findBusinessesForExport,
        findBusinessById: vi.fn(),
        updateBusinessLeadStatus: vi.fn()
      }
    );

    expect(findBusinessesForExport).toHaveBeenCalledWith({
      page: 1,
      page_size: 20
    });
    expect(result).toEqual([{ id: "business-1" }]);
  });

  it("delegates getBusinessById to the repository", async () => {
    const findBusinessById = vi.fn().mockResolvedValue(null);

    const result = await getBusinessById("business-1", {
      findBusinesses: vi.fn(),
      findBusinessesForExport: vi.fn(),
      findBusinessById,
      updateBusinessLeadStatus: vi.fn()
    });

    expect(findBusinessById).toHaveBeenCalledWith("business-1");
    expect(result).toBeNull();
  });

  it("delegates updateBusinessStatus without notes so existing notes are preserved", async () => {
    const updateBusinessLeadStatus = vi.fn().mockResolvedValue({
      id: "business-1"
    });

    const result = await updateBusinessStatus(
      "business-1",
      { status: "reviewed" },
      {
        findBusinesses: vi.fn(),
        findBusinessesForExport: vi.fn(),
        findBusinessById: vi.fn(),
        updateBusinessLeadStatus
      }
    );

    expect(updateBusinessLeadStatus).toHaveBeenCalledWith("business-1", {
      status: "reviewed"
    });
    expect(result).toEqual({ id: "business-1" });
  });

  it("delegates updateBusinessStatus with null notes so notes can be cleared", async () => {
    const updateBusinessLeadStatus = vi.fn().mockResolvedValue({
      id: "business-1"
    });

    const result = await updateBusinessStatus(
      "business-1",
      { status: "discarded", notes: null },
      {
        findBusinesses: vi.fn(),
        findBusinessesForExport: vi.fn(),
        findBusinessById: vi.fn(),
        updateBusinessLeadStatus
      }
    );

    expect(updateBusinessLeadStatus).toHaveBeenCalledWith("business-1", {
      status: "discarded",
      notes: null
    });
    expect(result).toEqual({ id: "business-1" });
  });
});
