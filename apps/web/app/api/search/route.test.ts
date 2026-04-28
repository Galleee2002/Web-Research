import { beforeEach, describe, expect, it, vi } from "vitest";

const createSearchRunMock = vi.fn();

vi.mock("@/lib/services/search-service", () => ({
  createSearchRun: createSearchRunMock
}));

describe("POST /api/search", () => {
  beforeEach(() => {
    createSearchRunMock.mockReset();
  });

  it("returns validation errors with correlation_id", async () => {
    const response = await import("./route").then(({ POST }) =>
      POST(
        new Request("http://localhost/api/search", {
          method: "POST",
          body: JSON.stringify({})
        })
      )
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("validation_error");
    expect(body.error.correlation_id).toEqual(expect.any(String));
  });

  it("returns invalid_json with correlation_id", async () => {
    const response = await import("./route").then(({ POST }) =>
      POST(
        new Request("http://localhost/api/search", {
          method: "POST",
          body: "{invalid",
          headers: {
            "Content-Type": "application/json"
          }
        })
      )
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("invalid_json");
    expect(body.error.correlation_id).toEqual(expect.any(String));
  });

  it("uses inbound X-Correlation-Id when creating a search run", async () => {
    createSearchRunMock.mockResolvedValue({
      id: "search-1",
      query: "dentists",
      location: "Buenos Aires",
      source: "google_places",
      status: "pending",
      total_found: 0,
      parent_search_run_id: null,
      page_number: 1,
      provider_next_page_available: false,
      created_at: "2026-04-23T00:00:00Z"
    });

    const response = await import("./route").then(({ POST }) =>
      POST(
        new Request("http://localhost/api/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Correlation-Id": "corr-123"
          },
          body: JSON.stringify({
            query: "dentists",
            location: "Buenos Aires"
          })
        })
      )
    );

    expect(response.status).toBe(201);
    expect(createSearchRunMock).toHaveBeenCalledWith(
      {
        query: "dentists",
        location: "Buenos Aires"
      },
      {
        correlationId: "corr-123",
        method: "POST",
        route: "/api/search"
      }
    );
  });
});
