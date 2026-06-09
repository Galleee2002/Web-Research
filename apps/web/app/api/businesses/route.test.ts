import { beforeEach, describe, expect, it, vi } from "vitest";

import { DatabaseOperationError } from "@/lib/api/http";

const listBusinessesMock = vi.fn();
const createManualBusinessMock = vi.fn();

vi.mock("@/lib/services/business-service", () => ({
  listBusinesses: listBusinessesMock,
  createManualBusiness: createManualBusinessMock
}));

describe("GET /api/businesses", () => {
  beforeEach(() => {
    listBusinessesMock.mockReset();
    createManualBusinessMock.mockReset();
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
          email: null,
          social_links: [],
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
      email: null,
      social_links: [],
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

describe("POST /api/businesses", () => {
  beforeEach(() => {
    listBusinessesMock.mockReset();
    createManualBusinessMock.mockReset();
  });

  it("creates a manual business and returns 201", async () => {
    createManualBusinessMock.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      name: "Clinica Manual",
      category: "Dentist",
      address: "Av. Corrientes 1234",
      city: null,
      phone: "+54 11 5555 1234",
      email: "contacto@clinica.example",
      social_links: ["https://instagram.com/clinica"],
      website: null,
      has_website: false,
      status: "new",
      maps_url: null,
      search_run_id: null,
      external_id: null,
      source: "manual",
      region: null,
      country: null,
      lat: null,
      lng: null,
      notes: "Lead manual",
      opportunity_selected: false,
      created_at: "2026-06-08T00:00:00.000Z",
      updated_at: "2026-06-08T00:00:00.000Z"
    });

    const response = await import("./route").then(({ POST }) =>
      POST(
        new Request("http://localhost/api/businesses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Correlation-Id": "corr-create"
          },
          body: JSON.stringify({
            name: "Clinica Manual",
            category: "Dentist",
            email: "contacto@clinica.example",
            phone: "+54 11 5555 1234",
            social_links: ["https://instagram.com/clinica"],
            address: "Av. Corrientes 1234",
            notes: "Lead manual"
          })
        })
      )
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.source).toBe("manual");
    expect(body.email).toBe("contacto@clinica.example");
    expect(createManualBusinessMock).toHaveBeenCalledWith(
      {
        name: "Clinica Manual",
        category: "Dentist",
        email: "contacto@clinica.example",
        phone: "+54 11 5555 1234",
        social_links: ["https://instagram.com/clinica"],
        address: "Av. Corrientes 1234",
        notes: "Lead manual"
      },
      {
        correlationId: "corr-create",
        method: "POST",
        route: "/api/businesses"
      }
    );
  });

  it("returns validation_error for invalid create payloads", async () => {
    const response = await import("./route").then(({ POST }) =>
      POST(
        new Request("http://localhost/api/businesses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "not-an-email" })
        })
      )
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("validation_error");
    expect(createManualBusinessMock).not.toHaveBeenCalled();
  });
});
