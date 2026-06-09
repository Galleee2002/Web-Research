import { beforeEach, describe, expect, it, vi } from "vitest";

const cancelPendingSearchRunMock = vi.fn();

vi.mock("@/lib/services/cancel-pending-search-run", () => ({
  cancelPendingSearchRun: cancelPendingSearchRunMock
}));

describe("DELETE /api/search/[id]", () => {
  beforeEach(() => {
    cancelPendingSearchRunMock.mockReset();
  });

  it("returns validation error for invalid id", async () => {
    const response = await import("./route").then(({ DELETE }) =>
      DELETE(
        new Request("http://localhost/api/search/not-a-uuid", { method: "DELETE" }),
        { params: Promise.resolve({ id: "not-a-uuid" }) }
      )
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("validation_error");
  });

  it("cancels a pending search run", async () => {
    const validId = "4cdb97bd-fc8e-4c35-8d0e-ca7ac802ddcb";
    cancelPendingSearchRunMock.mockResolvedValue({ id: validId });

    const response = await import("./route").then(({ DELETE }) =>
      DELETE(new Request(`http://localhost/api/search/${validId}`, { method: "DELETE" }), {
        params: Promise.resolve({ id: validId })
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ id: validId });
    expect(cancelPendingSearchRunMock).toHaveBeenCalledWith(validId, {
      correlationId: expect.any(String),
      method: "DELETE",
      route: "/api/search/[id]"
    });
  });
});
