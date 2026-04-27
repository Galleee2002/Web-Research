import { describe, it, expect, vi, beforeEach } from "vitest";
import { listProviderCalls } from "@/lib/services/scans";
import type { ScanFilters, ScanListItem } from "@shared/index";
import type { OperationContext } from "@/lib/api/http";

const mockOperationContext: OperationContext = {
  correlationId: "test-correlation-id",
  method: "GET",
  route: "/api/scans",
};

describe("scans service", () => {
  let mockGetProviderCalls: any;
  let mockCountGlobalRequestsDaily: any;

  beforeEach(() => {
    mockGetProviderCalls = vi.fn();
    mockCountGlobalRequestsDaily = vi.fn();
  });

  it("should list provider calls with pagination and global request count", async () => {
    const mockRows: ScanListItem[] = [
      {
        id: "test-id-1",
        searchRunId: "test-id-1",
        provider: "google_places",
        providerEndpoint: "google_places",
        httpStatus: null,
        startedAt: "2026-04-27T10:00:00Z",
        completedAt: "2026-04-27T10:00:05Z",
        errorCode: null,
        correlationId: "correlation-1",
        observability: { stage: "completed" },
      },
    ];

    mockGetProviderCalls.mockResolvedValue({
      rows: mockRows,
      total: 1,
    });

    mockCountGlobalRequestsDaily.mockResolvedValue(5);

    const filters: ScanFilters = {
      page: 1,
      page_size: 10,
    };

    const result = await listProviderCalls(filters, mockOperationContext, {
      getProviderCalls: mockGetProviderCalls,
      countGlobalRequestsDaily: mockCountGlobalRequestsDaily,
    });

    expect(result.items).toEqual(mockRows);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.page_size).toBe(10);
    expect(result.globalRequestCount).toBe(5);
  });

  it("should pass filters to getProviderCalls", async () => {
    mockGetProviderCalls.mockResolvedValue({
      rows: [],
      total: 0,
    });
    mockCountGlobalRequestsDaily.mockResolvedValue(0);

    const filters: ScanFilters = {
      page: 2,
      page_size: 20,
      provider: "google_places",
      status: "completed",
    };

    await listProviderCalls(filters, mockOperationContext, {
      getProviderCalls: mockGetProviderCalls,
      countGlobalRequestsDaily: mockCountGlobalRequestsDaily,
    });

    expect(mockGetProviderCalls).toHaveBeenCalledWith(filters, mockOperationContext);
  });

  it("should handle empty results", async () => {
    mockGetProviderCalls.mockResolvedValue({
      rows: [],
      total: 0,
    });
    mockCountGlobalRequestsDaily.mockResolvedValue(0);

    const filters: ScanFilters = {
      page: 1,
      page_size: 10,
    };

    const result = await listProviderCalls(filters, mockOperationContext, {
      getProviderCalls: mockGetProviderCalls,
      countGlobalRequestsDaily: mockCountGlobalRequestsDaily,
    });

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.globalRequestCount).toBe(0);
  });
});
