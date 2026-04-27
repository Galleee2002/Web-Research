import { beforeEach, describe, expect, it, vi } from "vitest";

const setOpportunitySelectionByBusinessIdMock = vi.fn();

vi.mock("@/lib/services/opportunity-service", () => ({
  setOpportunitySelectionByBusinessId: setOpportunitySelectionByBusinessIdMock,
}));

const VALID_BUSINESS_ID = "11111111-1111-4111-8111-111111111111";

describe("PATCH /api/opportunities/businesses/[businessId]", () => {
  beforeEach(() => {
    setOpportunitySelectionByBusinessIdMock.mockReset();
  });

  it("returns 400 for invalid UUID", async () => {
    const response = await import("./route").then(({ PATCH }) =>
      PATCH(
        new Request("http://localhost/api/opportunities/businesses/not-a-uuid", {
          method: "PATCH",
          body: JSON.stringify({ is_selected: true }),
        }),
        {
          params: Promise.resolve({ businessId: "not-a-uuid" }),
        },
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.details).toEqual(["businessId must be a valid UUID"]);
    expect(setOpportunitySelectionByBusinessIdMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid payload", async () => {
    const response = await import("./route").then(({ PATCH }) =>
      PATCH(
        new Request(`http://localhost/api/opportunities/businesses/${VALID_BUSINESS_ID}`, {
          method: "PATCH",
          body: JSON.stringify({}),
        }),
        {
          params: Promise.resolve({ businessId: VALID_BUSINESS_ID }),
        },
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.details).toEqual(["is_selected is required"]);
    expect(setOpportunitySelectionByBusinessIdMock).not.toHaveBeenCalled();
  });

  it("returns 404 when business does not exist", async () => {
    setOpportunitySelectionByBusinessIdMock.mockResolvedValue(null);

    const response = await import("./route").then(({ PATCH }) =>
      PATCH(
        new Request(`http://localhost/api/opportunities/businesses/${VALID_BUSINESS_ID}`, {
          method: "PATCH",
          body: JSON.stringify({ is_selected: true }),
        }),
        {
          params: Promise.resolve({ businessId: VALID_BUSINESS_ID }),
        },
      ),
    );

    expect(response.status).toBe(404);
  });

  it("upserts selection and returns payload", async () => {
    setOpportunitySelectionByBusinessIdMock.mockResolvedValue({
      opportunity_id: "22222222-2222-4222-8222-222222222222",
      business_id: VALID_BUSINESS_ID,
      is_selected: true,
      updated_at: "2026-04-27T00:00:00.000Z",
    });

    const response = await import("./route").then(({ PATCH }) =>
      PATCH(
        new Request(`http://localhost/api/opportunities/businesses/${VALID_BUSINESS_ID}`, {
          method: "PATCH",
          body: JSON.stringify({ is_selected: true }),
        }),
        {
          params: Promise.resolve({ businessId: VALID_BUSINESS_ID }),
        },
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      opportunity_id: "22222222-2222-4222-8222-222222222222",
      business_id: VALID_BUSINESS_ID,
      is_selected: true,
      updated_at: "2026-04-27T00:00:00.000Z",
    });
    expect(setOpportunitySelectionByBusinessIdMock).toHaveBeenCalledWith(
      VALID_BUSINESS_ID,
      { is_selected: true },
      expect.objectContaining({
        method: "PATCH",
        route: "/api/opportunities/businesses/[businessId]",
      }),
    );
  });
});
