import { describe, expect, it } from "vitest";

import { buildSearchListQuery } from "./searches";

describe("search query builder", () => {
  it("builds a parameterized filtered search list query", () => {
    const query = buildSearchListQuery({
      page: 3,
      page_size: 5,
      status: "completed",
      source: "google_places"
    }, "owner-1");

    expect(query.values).toEqual(["completed", "google_places", "owner-1", 5, 10]);
    expect(query.text).toContain("status = $1");
    expect(query.text).toContain("source = $2");
    expect(query.text).toContain("owner_user_id = $3::uuid");
    expect(query.text).toContain("order by created_at desc");
    expect(query.text).toContain("limit $4 offset $5");
  });
});
