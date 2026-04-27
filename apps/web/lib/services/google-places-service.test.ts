import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/http";

import { searchGooglePlaces } from "./google-places-service";

const operationContext = {
  correlationId: "corr-1",
  method: "POST",
  route: "/api/google/places/search",
};

describe("google-places-service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns mapped places from provider on success", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    vi.stubEnv("GOOGLE_REQUEST_TIMEOUT_SECONDS", "10");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: "OK",
          results: [{ place_id: "place-1", name: "Dental Clinic" }],
        }),
      }),
    );

    const response = await searchGooglePlaces(
      { query: "dentists", location: "Buenos Aires" },
      operationContext,
    );

    expect(response.results).toHaveLength(1);
    expect(response.results[0]?.place_id).toBe("place-1");
  });

  it("caps provider results to 20 items", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    vi.stubEnv("GOOGLE_REQUEST_TIMEOUT_SECONDS", "10");
    const providerResults = Array.from({ length: 25 }, (_, index) => ({
      place_id: `place-${index + 1}`,
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: "OK",
          results: providerResults,
        }),
      }),
    );

    const response = await searchGooglePlaces(
      { query: "dentists", location: "Buenos Aires" },
      operationContext,
    );

    expect(response.results).toHaveLength(20);
    expect(response.results[0]?.place_id).toBe("place-1");
    expect(response.results[19]?.place_id).toBe("place-20");
  });

  it("throws timeout_error when provider call times out", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
    vi.stubEnv("GOOGLE_REQUEST_TIMEOUT_SECONDS", "10");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError")),
    );

    await expect(
      searchGooglePlaces(
        { query: "dentists", location: "Buenos Aires" },
        operationContext,
      ),
    ).rejects.toMatchObject<ApiError>({
      code: "timeout_error",
      status: 504,
    });
  });
});
