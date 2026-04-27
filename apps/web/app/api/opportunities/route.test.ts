import { beforeEach, describe, expect, it, vi } from "vitest";

import { DatabaseOperationError } from "@/lib/api/http";

const listOpportunitiesMock = vi.fn();

vi.mock("@/lib/services/opportunity-service", () => ({
  listOpportunities: listOpportunitiesMock,
}));

describe("GET /api/opportunities", () => {
  beforeEach(() => {
    listOpportunitiesMock.mockReset();
  });

  it("lists opportunities with rating ordering by default", async () => {
    listOpportunitiesMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 20,
    });

    const response = await import("./route").then(({ GET }) =>
      GET(new Request("http://localhost/api/opportunities")),
    );

    expect(response.status).toBe(200);
    expect(listOpportunitiesMock).toHaveBeenCalledWith(
      {
        page: 1,
        page_size: 20,
        order_by: "rating",
      },
      expect.objectContaining({
        route: "/api/opportunities",
        method: "GET",
      }),
    );
  });

  it("returns validation errors for invalid order_by", async () => {
    const response = await import("./route").then(({ GET }) =>
      GET(new Request("http://localhost/api/opportunities?order_by=invalid")),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("validation_error");
    expect(body.error.details).toEqual([
      "order_by must be rating, created_at, name, or city",
    ]);
  });

  it("translates service database errors to the shared error envelope", async () => {
    listOpportunitiesMock.mockRejectedValue(
      new DatabaseOperationError("find_opportunities", new Error("connection failed")),
    );

    const response = await import("./route").then(({ GET }) =>
      GET(new Request("http://localhost/api/opportunities")),
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("database_error");
    expect(body.error.message).toBe("Database operation failed");
  });
});
