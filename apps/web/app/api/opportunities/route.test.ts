import { beforeEach, describe, expect, it, vi } from "vitest";

import { DatabaseOperationError } from "@/lib/api/http";

const listBusinessesMock = vi.fn();

vi.mock("@/lib/services/business-service", () => ({
  listBusinesses: listBusinessesMock
}));

describe("GET /api/opportunities", () => {
  beforeEach(() => {
    listBusinessesMock.mockReset();
  });

  it("returns only businesses filtered with opportunities status", async () => {
    listBusinessesMock.mockResolvedValue({
      items: [
        {
          id: "55555555-5555-4555-8555-555555555555",
          name: "Demo Opportunity",
          category: "Dentist",
          address: "Av. Santa Fe 1234",
          city: "Buenos Aires",
          phone: "+54 11 5555 0000",
          website: null,
          has_website: false,
          status: "opportunities",
          maps_url: "https://maps.google.com/?cid=456"
        }
      ],
      total: 1,
      page: 1,
      page_size: 100
    });

    const response = await import("./route").then(({ GET }) =>
      GET(
        new Request(
          "http://localhost/api/opportunities?page=1&page_size=999&has_website=false&city=Buenos%20Aires&category=Dentist&query=demo&order_by=created_at",
          {
            headers: { "X-Correlation-Id": "corr-opportunities" }
          }
        )
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items[0].status).toBe("opportunities");
    expect(listBusinessesMock).toHaveBeenCalledWith(
      {
        page: 1,
        page_size: 100,
        has_website: false,
        status: "opportunities",
        city: "Buenos Aires",
        category: "Dentist",
        query: "demo",
        order_by: "created_at"
      },
      {
        correlationId: "corr-opportunities",
        method: "GET",
        route: "/api/opportunities"
      }
    );
  });

  it("forces the opportunities status even if another status is passed", async () => {
    listBusinessesMock.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 20
    });

    const response = await import("./route").then(({ GET }) =>
      GET(new Request("http://localhost/api/opportunities?status=discarded"))
    );

    expect(response.status).toBe(200);
    expect(listBusinessesMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "opportunities" }),
      expect.objectContaining({ route: "/api/opportunities" })
    );
  });

  it("rejects invalid filters unrelated to status", async () => {
    const response = await import("./route").then(({ GET }) =>
      GET(new Request("http://localhost/api/opportunities?has_website=maybe&order_by=category"))
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("validation_error");
    expect(body.error.details).toEqual(
      expect.arrayContaining([
        "has_website must be true or false",
        "order_by must be created_at, name, or city"
      ])
    );
    expect(listBusinessesMock).not.toHaveBeenCalled();
  });

  it("translates service database errors to the shared error envelope", async () => {
    listBusinessesMock.mockRejectedValue(
      new DatabaseOperationError("find_businesses", new Error("connection failed"))
    );

    const response = await import("./route").then(({ GET }) =>
      GET(new Request("http://localhost/api/opportunities"))
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("database_error");
    expect(body.error.message).toBe("Database operation failed");
  });
});
