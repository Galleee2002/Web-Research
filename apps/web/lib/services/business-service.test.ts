import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/http";

import {
  createManualBusiness,
  getBusinessById,
  listBusinesses,
  listBusinessesForExport,
  updateBusiness,
  updateBusinessStatus
} from "./business-service";

describe("business service", () => {
  const context = {
    correlationId: "corr-1",
    method: "GET",
    route: "/api/businesses"
  } as const;

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
      context,
      {
        findBusinesses,
        findBusinessesForExport: vi.fn(),
        findBusinessById: vi.fn(),
        findManualBusinessDuplicate: vi.fn(),
        insertManualBusiness: vi.fn(),
        updateBusinessFields: vi.fn(),
        updateBusinessLeadStatus: vi.fn()
      }
    );

    expect(findBusinesses).toHaveBeenCalledWith({
      page: 1,
      page_size: 20,
      order_by: "created_at"
    }, context);
    expect(result).toEqual({
      items: [],
      total: 0,
      page: 1,
      page_size: 20
    });
  });

  it("creates a manual business after dedup and website classification", async () => {
    const findManualBusinessDuplicate = vi.fn().mockResolvedValue(null);
    const insertManualBusiness = vi.fn().mockResolvedValue({ id: "business-1", source: "manual" });

    const result = await createManualBusiness(
      {
        name: "Clinica Manual",
        website: "https://instagram.com/clinica",
        address: "Calle 1"
      },
      context,
      {
        findBusinesses: vi.fn(),
        findBusinessesForExport: vi.fn(),
        findBusinessById: vi.fn(),
        findManualBusinessDuplicate,
        insertManualBusiness,
        updateBusinessFields: vi.fn(),
        updateBusinessLeadStatus: vi.fn()
      }
    );

    expect(findManualBusinessDuplicate).toHaveBeenCalledWith(
      "Clinica Manual",
      "Calle 1",
      context,
      undefined
    );
    expect(insertManualBusiness).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Clinica Manual",
        website: null,
        has_website: false,
        address: "Calle 1"
      }),
      context
    );
    expect(result).toEqual({ id: "business-1", source: "manual" });
  });

  it("throws conflict when a manual duplicate exists", async () => {
    const findManualBusinessDuplicate = vi.fn().mockResolvedValue({ id: "dup-1" });

    await expect(
      createManualBusiness(
        { name: "Clinica", address: "Calle 1" },
        context,
        {
          findBusinesses: vi.fn(),
          findBusinessesForExport: vi.fn(),
          findBusinessById: vi.fn(),
          findManualBusinessDuplicate,
          insertManualBusiness: vi.fn(),
          updateBusinessFields: vi.fn(),
          updateBusinessLeadStatus: vi.fn()
        }
      )
    ).rejects.toEqual(
      new ApiError(
        "conflict_error",
        "A business with the same name and address already exists",
        409,
        ["dup-1"]
      )
    );
  });

  it("forbids profile updates on ingested businesses", async () => {
    const findBusinessById = vi.fn().mockResolvedValue({
      id: "business-1",
      source: "google_places",
      name: "Clinica",
      address: "Calle 1"
    });

    await expect(
      updateBusiness(
        "business-1",
        { email: "nuevo@example.com" },
        context,
        {
          findBusinesses: vi.fn(),
          findBusinessesForExport: vi.fn(),
          findBusinessById,
          findManualBusinessDuplicate: vi.fn(),
          insertManualBusiness: vi.fn(),
          updateBusinessFields: vi.fn(),
          updateBusinessLeadStatus: vi.fn()
        }
      )
    ).rejects.toEqual(
      new ApiError("forbidden", "Only manual businesses can update profile fields", 403)
    );
  });

  it("updates manual businesses and reclassifies website", async () => {
    const findBusinessById = vi.fn().mockResolvedValue({
      id: "business-1",
      source: "manual",
      name: "Clinica",
      address: "Calle 1"
    });
    const findManualBusinessDuplicate = vi.fn().mockResolvedValue(null);
    const updateBusinessFields = vi.fn().mockResolvedValue({ id: "business-1", has_website: true });

    const result = await updateBusiness(
      "business-1",
      { website: "https://clinica.example", notes: "Corregido" },
      context,
      {
        findBusinesses: vi.fn(),
        findBusinessesForExport: vi.fn(),
        findBusinessById,
        findManualBusinessDuplicate,
        insertManualBusiness: vi.fn(),
        updateBusinessFields,
        updateBusinessLeadStatus: vi.fn()
      }
    );

    expect(updateBusinessFields).toHaveBeenCalledWith(
      "business-1",
      {
        website: "https://clinica.example",
        has_website: true,
        notes: "Corregido"
      },
      context
    );
    expect(result).toEqual({ id: "business-1", has_website: true });
  });

  it("delegates updateBusinessStatus without notes so existing notes are preserved", async () => {
    const updateBusinessLeadStatus = vi.fn().mockResolvedValue({
      id: "business-1"
    });

    const result = await updateBusinessStatus(
      "business-1",
      { status: "reviewed" },
      context,
      {
        findBusinesses: vi.fn(),
        findBusinessesForExport: vi.fn(),
        findBusinessById: vi.fn(),
        findManualBusinessDuplicate: vi.fn(),
        insertManualBusiness: vi.fn(),
        updateBusinessFields: vi.fn(),
        updateBusinessLeadStatus
      }
    );

    expect(updateBusinessLeadStatus).toHaveBeenCalledWith("business-1", {
      status: "reviewed"
    }, context);
    expect(result).toEqual({ id: "business-1" });
  });
});
