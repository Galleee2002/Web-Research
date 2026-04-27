import { beforeEach, describe, expect, it, vi } from "vitest";

const searchGooglePlacesMock = vi.fn();

vi.mock("@/lib/services/google-places-service", () => ({
  searchGooglePlaces: searchGooglePlacesMock,
}));

describe("POST /api/google/places/search", () => {
  beforeEach(() => {
    searchGooglePlacesMock.mockReset();
  });

  it("returns validation errors with correlation_id", async () => {
    const response = await import("./route").then(({ POST }) =>
      POST(
        new Request("http://localhost/api/google/places/search", {
          method: "POST",
          body: JSON.stringify({}),
        }),
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("validation_error");
    expect(body.error.correlation_id).toEqual(expect.any(String));
  });

  it("uses inbound X-Correlation-Id when calling google places service", async () => {
    searchGooglePlacesMock.mockResolvedValue({ results: [] });

    const response = await import("./route").then(({ POST }) =>
      POST(
        new Request("http://localhost/api/google/places/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Correlation-Id": "corr-123",
          },
          body: JSON.stringify({
            query: "dentists",
            location: "Buenos Aires",
          }),
        }),
      ),
    );

    expect(response.status).toBe(200);
    expect(searchGooglePlacesMock).toHaveBeenCalledWith(
      {
        query: "dentists",
        location: "Buenos Aires",
      },
      {
        correlationId: "corr-123",
        method: "POST",
        route: "/api/google/places/search",
      },
    );
  });
});

