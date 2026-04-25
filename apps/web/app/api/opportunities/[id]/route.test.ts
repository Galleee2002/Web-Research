import { beforeEach, describe, expect, it, vi } from "vitest";

const getOpportunityByIdMock = vi.fn();
const setOpportunityRatingMock = vi.fn();

vi.mock("@/lib/services/opportunity-service", () => ({
  getOpportunityById: getOpportunityByIdMock,
  setOpportunityRating: setOpportunityRatingMock,
}));

describe("GET /api/opportunities/[id]", () => {
  beforeEach(() => {
    getOpportunityByIdMock.mockReset();
    setOpportunityRatingMock.mockReset();
  });

  it("returns 404 when the opportunity does not exist", async () => {
    getOpportunityByIdMock.mockResolvedValue(null);

    const response = await import("./route").then(({ GET }) =>
      GET(new Request("http://localhost/api/opportunities/id"), {
        params: Promise.resolve({
          id: "00000000-0000-4000-8000-000000000000",
        }),
      }),
    );

    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/opportunities/[id]", () => {
  beforeEach(() => {
    getOpportunityByIdMock.mockReset();
    setOpportunityRatingMock.mockReset();
  });

  it("updates an opportunity rating", async () => {
    setOpportunityRatingMock.mockResolvedValue({
      id: "opportunity-1",
      rating: 4,
    });

    const response = await import("./route").then(({ PATCH }) =>
      PATCH(
        new Request("http://localhost/api/opportunities/id", {
          method: "PATCH",
          body: JSON.stringify({ rating: 4 }),
        }),
        {
          params: Promise.resolve({
            id: "00000000-0000-4000-8000-000000000000",
          }),
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(setOpportunityRatingMock).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000000",
      { rating: 4 },
      {
        correlationId: expect.any(String),
        method: "PATCH",
        route: "/api/opportunities/[id]",
      },
    );
  });

  it("returns validation errors for invalid ratings", async () => {
    const response = await import("./route").then(({ PATCH }) =>
      PATCH(
        new Request("http://localhost/api/opportunities/id", {
          method: "PATCH",
          body: JSON.stringify({ rating: 6 }),
        }),
        {
          params: Promise.resolve({
            id: "00000000-0000-4000-8000-000000000000",
          }),
        },
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.details).toEqual([
      "rating must be an integer from 1 to 5 or null",
    ]);
  });

  it("returns 404 when the opportunity does not exist", async () => {
    setOpportunityRatingMock.mockResolvedValue(null);

    const response = await import("./route").then(({ PATCH }) =>
      PATCH(
        new Request("http://localhost/api/opportunities/id", {
          method: "PATCH",
          body: JSON.stringify({ rating: null }),
        }),
        {
          params: Promise.resolve({
            id: "00000000-0000-4000-8000-000000000000",
          }),
        },
      ),
    );

    expect(response.status).toBe(404);
  });
});
