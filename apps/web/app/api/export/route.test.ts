import { beforeEach, describe, expect, it, vi } from "vitest";

const listBusinessesForExportMock = vi.fn();

vi.mock("@/lib/services/business-service", () => ({
  listBusinessesForExport: listBusinessesForExportMock
}));

describe("GET /api/export", () => {
  beforeEach(() => {
    listBusinessesForExportMock.mockReset();
  });

  it("exports filtered businesses as CSV with stable headers", async () => {
    listBusinessesForExportMock.mockResolvedValue([
      {
        id: "55555555-5555-4555-8555-555555555555",
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
    ]);

    const response = await import("./route").then(({ GET }) =>
      GET(
        new Request(
          "http://localhost/api/export?has_website=false&status=new&query=demo&order_by=name",
          {
            headers: { "X-Correlation-Id": "corr-export" }
          }
        )
      )
    );
    const csv = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="business-leads.csv"'
    );
    expect(csv.split("\n")[0]).toBe(
      "name,category,address,city,phone,website,has_website,status,maps_url"
    );
    expect(csv).toContain("Clinica Demo,Dentist,Av. Corrientes 1234");
    expect(listBusinessesForExportMock).toHaveBeenCalledWith(
      {
        page: 1,
        page_size: 20,
        has_website: false,
        status: "new",
        query: "demo",
        order_by: "name"
      },
      {
        correlationId: "corr-export",
        method: "GET",
        route: "/api/export"
      }
    );
  });

  it("returns validation_error for unsupported export filters", async () => {
    const response = await import("./route").then(({ GET }) =>
      GET(new Request("http://localhost/api/export?order_by=category"))
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("validation_error");
    expect(body.error.correlation_id).toEqual(expect.any(String));
    expect(listBusinessesForExportMock).not.toHaveBeenCalled();
  });
});
