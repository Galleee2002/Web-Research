import { beforeEach, describe, expect, it, vi } from "vitest";

import { DatabaseOperationError } from "@/lib/api/http";

const listOpportunityCategoriesMock = vi.fn();

vi.mock("@/lib/services/opportunity-service", () => ({
  listOpportunityCategories: listOpportunityCategoriesMock,
}));

describe("GET /api/opportunities/categories", () => {
  beforeEach(() => {
    listOpportunityCategoriesMock.mockReset();
  });

  it("returns distinct opportunity categories", async () => {
    listOpportunityCategoriesMock.mockResolvedValue({
      categories: ["Cafe", "Real estate agency"],
    });

    const response = await import("./route").then(({ GET }) =>
      GET(new Request("http://localhost/api/opportunities/categories")),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(listOpportunityCategoriesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        route: "/api/opportunities/categories",
        method: "GET",
      }),
    );
    expect(body).toEqual({ categories: ["Cafe", "Real estate agency"] });
  });

  it("translates service database errors to the shared error envelope", async () => {
    listOpportunityCategoriesMock.mockRejectedValue(
      new DatabaseOperationError(
        "find_opportunity_category_values",
        new Error("connection failed"),
      ),
    );

    const response = await import("./route").then(({ GET }) =>
      GET(new Request("http://localhost/api/opportunities/categories")),
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("database_error");
    expect(body.error.message).toBe("Database operation failed");
  });
});
