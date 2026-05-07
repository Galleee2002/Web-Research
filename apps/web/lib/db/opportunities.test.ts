import { describe, expect, it } from "vitest";

import {
  buildOpportunityDistinctCategoriesQuery,
  buildOpportunityListQuery,
} from "./opportunities";

describe("opportunity query builder", () => {
  it("builds a parameterized filtered opportunity list query", () => {
    const query = buildOpportunityListQuery({
      page: 2,
      page_size: 10,
      status: "new",
      city: "Buenos Aires",
      category: "Dentist",
      query: "dental",
      order_by: "name",
    }, "owner-1");

    expect(query.values).toEqual([
      "new",
      "Buenos Aires",
      "Dentist",
      "%dental%",
      "owner-1",
      10,
      10,
    ]);
    expect(query.text).toContain("inner join businesses on businesses.id = opportunities.business_id");
    expect(query.text).toContain("opportunities.is_selected = true");
    expect(query.text).toContain("businesses.status <> 'discarded'");
    expect(query.text).toContain("businesses.status = $1");
    expect(query.text).toContain("businesses.city = $2");
    expect(query.text).toContain("businesses.category = $3");
    expect(query.text).toContain("businesses.name ilike $4");
    expect(query.text).toContain("opportunities.owner_user_id = $5::uuid");
    expect(query.text).toContain(
      "order by businesses.name asc, opportunities.created_at desc, opportunities.id asc",
    );
    expect(query.text).toContain("limit $6 offset $7");
  });

  it("defaults to rating ordering and first page offset", () => {
    const query = buildOpportunityListQuery({
      page: 1,
      page_size: 20,
    }, "owner-1");

    expect(query.values).toEqual(["owner-1", 20, 0]);
    expect(query.text).toContain("opportunities.is_selected = true");
    expect(query.text).toContain("businesses.status <> 'discarded'");
    expect(query.text).toContain(
      "order by opportunities.rating desc nulls last, opportunities.created_at desc, opportunities.id asc",
    );
    expect(query.text).toContain("opportunities.owner_user_id = $1::uuid");
    expect(query.text).toContain("limit $2 offset $3");
  });

  it("builds distinct category query with the same visibility clauses as the list", () => {
    const query = buildOpportunityDistinctCategoriesQuery("owner-1");

    expect(query.values).toEqual(["owner-1"]);
    expect(query.text).toContain("select distinct businesses.category as category");
    expect(query.text).toContain("inner join businesses on businesses.id = opportunities.business_id");
    expect(query.text).toContain("opportunities.is_selected = true");
    expect(query.text).toContain("businesses.status <> 'discarded'");
    expect(query.text).toContain("businesses.category is not null");
    expect(query.text).toContain("opportunities.owner_user_id = $1::uuid");
    expect(query.text).toContain("order by businesses.category asc");
  });
});
