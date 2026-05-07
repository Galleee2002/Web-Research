import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/http";

const createNextSearchRunMock = vi.fn();

vi.mock("@/lib/services/search-service", () => ({
  createNextSearchRun: createNextSearchRunMock
}));

describe("POST /api/search/[id]/next", () => {
  const validId = "11111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    createNextSearchRunMock.mockReset();
  });

  it("returns validation errors with correlation_id for invalid UUID", async () => {
    const response = await import("./route").then(({ POST }) =>
      POST(
        new Request("http://localhost/api/search/not-a-uuid/next", {
          method: "POST"
        }),
        { params: Promise.resolve({ id: "not-a-uuid" }) }
      )
    );

    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error.code).toBe("validation_error");
    expect(body.error.correlation_id).toEqual(expect.any(String));
  });

  it("returns 201 when creating a new child run", async () => {
    createNextSearchRunMock.mockResolvedValue({
      created: true,
      searchRun: {
        id: "22222222-2222-4222-8222-222222222222",
        query: "dentists",
        location: "Buenos Aires",
        source: "google_places",
        status: "pending",
        total_found: 0,
        parent_search_run_id: validId,
        page_number: 2,
        provider_next_page_available: false,
        created_at: "2026-04-28T12:00:00.000Z"
      }
    });

    const response = await import("./route").then(({ POST }) =>
      POST(
        new Request(`http://localhost/api/search/${validId}/next`, {
          method: "POST",
          headers: {
            "X-Correlation-Id": "corr-next"
          }
        }),
        { params: Promise.resolve({ id: validId }) }
      )
    );

    expect(response.status).toBe(201);
    expect(createNextSearchRunMock).toHaveBeenCalledWith(validId, {
      correlationId: "corr-next",
      method: "POST",
      route: "/api/search/[id]/next"
    });
  });

  it("returns 200 when next call is idempotent", async () => {
    createNextSearchRunMock.mockResolvedValue({
      created: false,
      searchRun: {
        id: "33333333-3333-4333-8333-333333333333",
        query: "dentists",
        location: "Buenos Aires",
        source: "google_places",
        status: "pending",
        total_found: 0,
        parent_search_run_id: validId,
        page_number: 2,
        provider_next_page_available: false,
        created_at: "2026-04-28T12:00:00.000Z"
      }
    });

    const response = await import("./route").then(({ POST }) =>
      POST(
        new Request(`http://localhost/api/search/${validId}/next`, {
          method: "POST"
        }),
        { params: Promise.resolve({ id: validId }) }
      )
    );

    expect(response.status).toBe(200);
  });

  it("propagates not_found errors with correlation_id", async () => {
    createNextSearchRunMock.mockRejectedValueOnce(
      new ApiError("not_found", "Search run not found", 404)
    );

    const response = await import("./route").then(({ POST }) =>
      POST(
        new Request(`http://localhost/api/search/${validId}/next`, {
          method: "POST"
        }),
        { params: Promise.resolve({ id: validId }) }
      )
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("not_found");
    expect(body.error.correlation_id).toEqual(expect.any(String));
  });

  it("propagates conflict errors with correlation_id", async () => {
    createNextSearchRunMock.mockRejectedValueOnce(
      new ApiError(
        "conflict_error",
        "Search run does not have a next page token",
        409
      )
    );

    const response = await import("./route").then(({ POST }) =>
      POST(
        new Request(`http://localhost/api/search/${validId}/next`, {
          method: "POST"
        }),
        { params: Promise.resolve({ id: validId }) }
      )
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("conflict_error");
    expect(body.error.correlation_id).toEqual(expect.any(String));
  });
});
