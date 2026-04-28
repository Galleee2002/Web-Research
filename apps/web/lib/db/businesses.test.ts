import { describe, expect, it } from "vitest";

import { buildBusinessExportQuery, buildBusinessListQuery } from "./businesses";

describe("business query builder", () => {
  it("builds a parameterized filtered business list query", () => {
    const query = buildBusinessListQuery({
      page: 2,
      page_size: 10,
      has_website: false,
      status: "new",
      city: "Buenos Aires",
      category: "Dentist",
      query: "dental",
      order_by: "name"
    });

    expect(query.values).toEqual([
      false,
      "new",
      "Buenos Aires",
      "Dentist",
      "%dental%",
      10,
      10
    ]);
    expect(query.text).toContain("has_website = $1");
    expect(query.text).toContain("status = $2");
    expect(query.text).toContain("city = $3");
    expect(query.text).toContain("category = $4");
    expect(query.text).toContain(
      "(name ilike $5 OR id::text ilike $5)"
    );
    expect(query.text).toContain("order by name asc");
    expect(query.text).toContain("limit $6 offset $7");
  });

  it("defaults to created_at ordering and first page offset", () => {
    const query = buildBusinessListQuery({
      page: 1,
      page_size: 20
    });

    expect(query.values).toEqual([20, 0]);
    expect(query.text).toContain("order by created_at desc");
    expect(query.text).toContain("limit $1 offset $2");
  });

  it("uses the same filters for export without paginating results", () => {
    const query = buildBusinessExportQuery({
      page: 1,
      page_size: 20,
      has_website: false,
      status: "new",
      city: "Buenos Aires",
      category: "Dentist",
      query: "dental",
      order_by: "city"
    });

    expect(query.values).toEqual([
      false,
      "new",
      "Buenos Aires",
      "Dentist",
      "%dental%"
    ]);
    expect(query.text).toContain("has_website = $1");
    expect(query.text).toContain("status = $2");
    expect(query.text).toContain("city = $3");
    expect(query.text).toContain("category = $4");
    expect(query.text).toContain(
      "(name ilike $5 OR id::text ilike $5)"
    );
    expect(query.text).toContain("order by city asc");
    expect(query.text).not.toContain("limit");
    expect(query.text).not.toContain("offset");
  });
}
);
