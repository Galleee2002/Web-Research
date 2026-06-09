import { beforeEach, describe, expect, it, vi } from "vitest";

const getBusinessByIdMock = vi.fn();
const updateBusinessMock = vi.fn();

vi.mock("@/lib/services/business-service", () => ({
  getBusinessById: getBusinessByIdMock,
  updateBusiness: updateBusinessMock
}));

const VALID_ID = "33333333-3333-4333-8333-333333333333";

function routeContext(id: string) {
  return {
    params: Promise.resolve({ id })
  };
}

describe("GET /api/businesses/[id]", () => {
  beforeEach(() => {
    getBusinessByIdMock.mockReset();
    updateBusinessMock.mockReset();
  });

  it("returns validation_error for an invalid UUID", async () => {
    const response = await import("./route").then(({ GET }) =>
      GET(new Request("http://localhost/api/businesses/not-a-uuid"), routeContext("not-a-uuid"))
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("validation_error");
    expect(body.error.correlation_id).toEqual(expect.any(String));
    expect(getBusinessByIdMock).not.toHaveBeenCalled();
  });

  it("returns not_found for a missing business", async () => {
    getBusinessByIdMock.mockResolvedValue(null);

    const response = await import("./route").then(({ GET }) =>
      GET(new Request(`http://localhost/api/businesses/${VALID_ID}`), routeContext(VALID_ID))
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error.code).toBe("not_found");
    expect(body.error.message).toBe("Business not found");
    expect(body.error.correlation_id).toEqual(expect.any(String));
  });

  it("returns the full detail contract consumed by the dashboard", async () => {
    getBusinessByIdMock.mockResolvedValue({
      id: VALID_ID,
      name: "Clinica Demo",
      category: "Dentist",
      address: "Av. Corrientes 1234",
      city: "Buenos Aires",
      phone: "+54 11 5555 1234",
      email: "contacto@clinica.example",
      social_links: ["https://instagram.com/clinicademo"],
      website: "https://clinicademo.example",
      has_website: true,
      status: "reviewed",
      maps_url: "https://maps.google.com/?cid=123",
      search_run_id: "44444444-4444-4444-8444-444444444444",
      external_id: "place-1",
      source: "google_places",
      region: "CABA",
      country: "Argentina",
      lat: -34.6037,
      lng: -58.3816,
      notes: "Call next week",
      opportunity_selected: false,
      created_at: "2026-04-23T00:00:00.000Z",
      updated_at: "2026-04-23T01:00:00.000Z"
    });

    const response = await import("./route").then(({ GET }) =>
      GET(
        new Request(`http://localhost/api/businesses/${VALID_ID}`, {
          headers: { "X-Correlation-Id": "corr-detail" }
        }),
        routeContext(VALID_ID)
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: VALID_ID,
      email: "contacto@clinica.example",
      social_links: ["https://instagram.com/clinicademo"],
      notes: "Call next week",
      lat: -34.6037,
      lng: -58.3816,
      created_at: "2026-04-23T00:00:00.000Z",
      updated_at: "2026-04-23T01:00:00.000Z"
    });
    expect(getBusinessByIdMock).toHaveBeenCalledWith(VALID_ID, {
      correlationId: "corr-detail",
      method: "GET",
      route: "/api/businesses/[id]"
    });
  });
});

describe("PATCH /api/businesses/[id]", () => {
  beforeEach(() => {
    getBusinessByIdMock.mockReset();
    updateBusinessMock.mockReset();
  });

  it("updates manual profile fields and lead status", async () => {
    updateBusinessMock.mockResolvedValue({
      id: VALID_ID,
      name: "Clinica Actualizada",
      category: "Dentist",
      address: "Av. Corrientes 1234",
      city: null,
      phone: "+54 11 5555 9999",
      email: "nuevo@clinica.example",
      social_links: ["https://instagram.com/clinica"],
      website: null,
      has_website: false,
      status: "reviewed",
      maps_url: null,
      search_run_id: null,
      external_id: null,
      source: "manual",
      region: null,
      country: null,
      lat: null,
      lng: null,
      notes: "Corregido",
      opportunity_selected: false,
      created_at: "2026-04-23T00:00:00.000Z",
      updated_at: "2026-04-23T02:00:00.000Z"
    });

    const response = await import("./route").then(({ PATCH }) =>
      PATCH(
        new Request(`http://localhost/api/businesses/${VALID_ID}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-Correlation-Id": "corr-patch"
          },
          body: JSON.stringify({
            name: "Clinica Actualizada",
            email: "nuevo@clinica.example",
            social_links: ["https://instagram.com/clinica"],
            status: "reviewed",
            notes: "Corregido"
          })
        }),
        routeContext(VALID_ID)
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.email).toBe("nuevo@clinica.example");
    expect(body.name).toBe("Clinica Actualizada");
    expect(updateBusinessMock).toHaveBeenCalledWith(
      VALID_ID,
      {
        name: "Clinica Actualizada",
        email: "nuevo@clinica.example",
        social_links: ["https://instagram.com/clinica"],
        status: "reviewed",
        notes: "Corregido"
      },
      {
        correlationId: "corr-patch",
        method: "PATCH",
        route: "/api/businesses/[id]"
      }
    );
  });

  it("allows status-only updates for compatibility", async () => {
    updateBusinessMock.mockResolvedValue({
      id: VALID_ID,
      status: "discarded",
      notes: null
    });

    const response = await import("./route").then(({ PATCH }) =>
      PATCH(
        new Request(`http://localhost/api/businesses/${VALID_ID}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "discarded", notes: null })
        }),
        routeContext(VALID_ID)
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("discarded");
    expect(updateBusinessMock).toHaveBeenCalledWith(
      VALID_ID,
      { status: "discarded", notes: null },
      expect.objectContaining({ route: "/api/businesses/[id]" })
    );
  });

  it("returns validation_error for invalid status", async () => {
    const response = await import("./route").then(({ PATCH }) =>
      PATCH(
        new Request(`http://localhost/api/businesses/${VALID_ID}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "archived" })
        }),
        routeContext(VALID_ID)
      )
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("validation_error");
    expect(body.error.correlation_id).toEqual(expect.any(String));
    expect(updateBusinessMock).not.toHaveBeenCalled();
  });

  it("returns validation_error for empty payloads", async () => {
    const response = await import("./route").then(({ PATCH }) =>
      PATCH(
        new Request(`http://localhost/api/businesses/${VALID_ID}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({})
        }),
        routeContext(VALID_ID)
      )
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("validation_error");
    expect(updateBusinessMock).not.toHaveBeenCalled();
  });

  it("returns invalid_json for malformed JSON", async () => {
    const response = await import("./route").then(({ PATCH }) =>
      PATCH(
        new Request(`http://localhost/api/businesses/${VALID_ID}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: "{invalid"
        }),
        routeContext(VALID_ID)
      )
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("invalid_json");
    expect(body.error.correlation_id).toEqual(expect.any(String));
  });
});
