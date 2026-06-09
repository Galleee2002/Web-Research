import { beforeEach, describe, expect, it, vi } from "vitest";

const deletePendingSearchRunMock = vi.fn();
const findSearchRunRecordByIdMock = vi.fn();

vi.mock("@/lib/db/searches", () => ({
  deletePendingSearchRun: deletePendingSearchRunMock,
  findSearchRunRecordById: findSearchRunRecordByIdMock
}));

describe("cancelPendingSearchRun", () => {
  beforeEach(() => {
    deletePendingSearchRunMock.mockReset();
    findSearchRunRecordByIdMock.mockReset();
  });

  it("cancels a pending search run", async () => {
    deletePendingSearchRunMock.mockResolvedValue(true);

    const { cancelPendingSearchRun } = await import("./cancel-pending-search-run");
    const result = await cancelPendingSearchRun("search-pending", {
      correlationId: "corr-cancel",
      method: "DELETE",
      route: "/api/search/[id]"
    });

    expect(result).toEqual({ id: "search-pending" });
    expect(deletePendingSearchRunMock).toHaveBeenCalledWith("search-pending", {
      correlationId: "corr-cancel",
      method: "DELETE",
      route: "/api/search/[id]"
    });
  });

  it("rejects cancelling a non-pending search run", async () => {
    deletePendingSearchRunMock.mockResolvedValue(false);
    findSearchRunRecordByIdMock.mockResolvedValue({
      id: "search-processing",
      status: "processing"
    });

    const { cancelPendingSearchRun } = await import("./cancel-pending-search-run");
    await expect(
      cancelPendingSearchRun("search-processing", {
        correlationId: "corr-cancel",
        method: "DELETE",
        route: "/api/search/[id]"
      })
    ).rejects.toMatchObject({ code: "conflict_error", status: 409 });
  });
});
