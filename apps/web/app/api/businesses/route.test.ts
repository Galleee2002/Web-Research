import { beforeEach, describe, expect, it, vi } from "vitest";

import { DatabaseOperationError } from "@/lib/api/http";

const listBusinessesMock = vi.fn();

vi.mock("@/lib/services/business-service", () => ({
  listBusinesses: listBusinessesMock
}));

describe("GET /api/businesses", () => {
  beforeEach(() => {
    listBusinessesMock.mockReset();
  });

  it("returns the paginated business contract consumed by the dashboard", async () => {
    listBusinessesMock.mockResolvedValue({
      items: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          name: "Clinica Demo",
          category: "Dentist",
          address: "Av. Corrientes 1234",
          city: "Buenos Aires",
          phone: "+54 11 5555 1234",
          website: null,
          has_website: false,
          status: "new",
          maps_url: "https://maps.google.com/?cid=123"
        }
      ],
      total: 1,
      page: 1,
      page_size: 100
    });

    const response = await import("./route").then(({ GET }) =>
      GET(
        new Request(
          "http://localhost/api/businesses?page=1&page_size=999&has_website=false&status=new&city=Buenos%20Aires&category=Dentist&query=demo&order_by=created_at",
          {
            headers: { "X-Correlation-Id": "corr-businesses" }
          }
        )
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items[0]).toEqual({
      id: "22222222-2222-4222-8222-222222222222",
      name: "Clinica Demo",
      category: "Dentist",
      address: "Av. Corrientes 1234",
      city: "Buenos Aires",
      phone: "+54 11 5555 1234",
      website: null,
      has_website: false,
      status: "new",
      maps_url: "https://maps.google.com/?cid=123"
    });
    expect(body.total).toBe(1);
    expect(listBusinessesMock).toHaveBeenCalledWith(
      {
        page: 1,
        page_size: 100,
        has_website: false,
        status: "new",
        city: "Buenos Aires",
        category: "Dentist",
        query: "demo",
        order_by: "created_at"
      },
      {
        correlationId: "corr-businesses",
        method: "GET",
        route: "/api/businesses"
      }
    );
  });

  it("rejects invalid filters and unsupported backend ordering", async () => {
    const response = await import("./route").then(({ GET }) =>
      GET(new Request("http://localhost/api/businesses?has_website=maybe&order_by=category"))
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("validation_error");
    expect(body.error.correlation_id).toEqual(expect.any(String));
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
      GET(new Request("http://localhost/api/businesses"))
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error.code).toBe("database_error");
    expect(body.error.message).toBe("Database operation failed");
    expect(body.error.correlation_id).toEqual(expect.any(String));
  });
});
