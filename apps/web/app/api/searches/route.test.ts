import { beforeEach, describe, expect, it, vi } from "vitest";

import { DatabaseOperationError } from "@/lib/api/http";

const listSearchRunsMock = vi.fn();

vi.mock("@/lib/services/search-service", () => ({
  listSearchRuns: listSearchRunsMock
}));

describe("GET /api/searches", () => {
  beforeEach(() => {
    listSearchRunsMock.mockReset();
  });

  it("returns paginated search runs with the inbound correlation id", async () => {
    listSearchRunsMock.mockResolvedValue({
      items: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          query: "dentists",
          location: "Buenos Aires",
          source: "google_places",
          status: "completed",
          total_found: 3,
          parent_search_run_id: null,
          page_number: 1,
          provider_next_page_available: true,
          created_at: "2026-04-23T00:00:00.000Z"
        }
      ],
      total: 1,
      page: 1,
      page_size: 20
    });

    const response = await import("./route").then(({ GET }) =>
      GET(
        new Request(
          "http://localhost/api/searches?page=1&page_size=20&status=completed&source=google_places",
          {
            method: "GET",
            headers: { "X-Correlation-Id": "corr-searches" }
          }
        )
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      items: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          query: "dentists",
          location: "Buenos Aires",
          source: "google_places",
          status: "completed",
          total_found: 3,
          parent_search_run_id: null,
          page_number: 1,
          provider_next_page_available: true,
          created_at: "2026-04-23T00:00:00.000Z"
        }
      ],
      total: 1,
      page: 1,
      page_size: 20
    });
    expect(listSearchRunsMock).toHaveBeenCalledWith(
      {
        page: 1,
        page_size: 20,
        status: "completed",
        source: "google_places"
      },
      {
        correlationId: "corr-searches",
        method: "GET",
        route: "/api/searches"
      }
    );
  });

  it("returns validation_error for invalid search status", async () => {
    const response = await import("./route").then(({ GET }) =>
      GET(new Request("http://localhost/api/searches?status=archived"))
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("validation_error");
    expect(body.error.correlation_id).toEqual(expect.any(String));
    expect(body.error.details).toContain("status is not a valid search run status");
    expect(listSearchRunsMock).not.toHaveBeenCalled();
  });

  it("translates service database errors to the shared error envelope", async () => {
    listSearchRunsMock.mockRejectedValue(
      new DatabaseOperationError("find_search_runs", new Error("connection failed"))
    );

    const response = await import("./route").then(({ GET }) =>
      GET(new Request("http://localhost/api/searches"))
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("database_error");
    expect(body.error.correlation_id).toEqual(expect.any(String));
  });
});
