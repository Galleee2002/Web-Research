import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  findBusinessById,
  findBusinesses,
  updateBusinessLeadStatus,
} from "./businesses";
import {
  findOpportunityById,
  findOpportunities,
  updateOpportunityRating,
} from "./opportunities";
import { query } from "./pool";
import { findSearchRuns, insertSearchRun } from "./searches";

describe.skipIf(!process.env.DATABASE_URL)("database integration", () => {
  const context = {
    correlationId: "integration-test",
    method: "GET",
    route: "/integration-test",
  } as const;

  it("lists businesses through the repository contract", async () => {
    const result = await findBusinesses({
      page: 1,
      page_size: 20,
      order_by: "created_at",
    }, context);

    expect(Array.isArray(result.items)).toBe(true);
    expect(result.page).toBe(1);
    expect(result.page_size).toBe(20);
    expect(result.total).toBeGreaterThanOrEqual(0);
  });

  it("returns null for a missing business id", async () => {
    const business = await findBusinessById(
      "00000000-0000-4000-8000-000000000000",
      context,
    );

    expect(business).toBeNull();
  });

  it("creates and lists a search run through repository contracts", async () => {
    const suffix = randomUUID();
    const searchRun = await insertSearchRun(
      {
        query: `integration dentists ${suffix}`,
        location: "Buenos Aires, Argentina",
      },
      {
        correlationId: `integration-${suffix}`,
        method: "POST",
        route: "/api/search",
      },
    );

    try {
      expect(searchRun.status).toBe("pending");
      expect(searchRun.source).toBe("google_places");

      const listed = await findSearchRuns({
        page: 1,
        page_size: 20,
        status: "pending",
        source: "google_places",
      }, context);

      expect(listed.items.some((item) => item.id === searchRun.id)).toBe(true);
    } finally {
      await query("delete from search_runs where id = $1", [searchRun.id], {
        operationName: "cleanup_search_run",
        context,
      });
    }
  });

  it("updates lead status while preserving omitted notes and clearing null notes", async () => {
    const suffix = randomUUID();
    const insertResult = await query<{ id: string }>(
      `
        insert into businesses (
          source,
          name,
          address,
          has_website,
          status,
          notes
        )
        values ('google_places', $1, $2, false, 'new', 'Initial note')
        returning id
      `,
      [`Integration Business ${suffix}`, `Integration Address ${suffix}`],
      {
        operationName: "insert_integration_business",
        context,
      },
    );
    const id = insertResult.rows[0].id;

    try {
      const reviewed = await updateBusinessLeadStatus(id, { status: "reviewed" }, context);
      expect(reviewed?.status).toBe("reviewed");
      expect(reviewed?.notes).toBe("Initial note");

      const discarded = await updateBusinessLeadStatus(
        id,
        { status: "discarded", notes: null },
        context,
      );
      expect(discarded?.status).toBe("discarded");
      expect(discarded?.notes).toBeNull();
    } finally {
      await query("delete from businesses where id = $1", [id], {
        operationName: "cleanup_business",
        context,
      });
    }
  });

  it("creates, lists, updates, and clears opportunities without relying on demo seed data", async () => {
    const suffix = randomUUID();
    const insertBusinessResult = await query<{ id: string }>(
      `
        insert into businesses (
          source,
          name,
          address,
          city,
          has_website,
          status,
          notes
        )
        values ('google_places', $1, $2, 'Buenos Aires', false, 'new', 'Opportunity note')
        returning id
      `,
      [`Opportunity Business ${suffix}`, `Opportunity Address ${suffix}`],
      {
        operationName: "insert_opportunity_business",
        context,
      },
    );
    const businessId = insertBusinessResult.rows[0].id;

    const insertOpportunityResult = await query<{ id: string }>(
      `
        insert into opportunities (business_id, rating, is_selected)
        values ($1, null, true)
        returning id
      `,
      [businessId],
      {
        operationName: "insert_opportunity",
        context,
      },
    );
    const opportunityId = insertOpportunityResult.rows[0].id;

    try {
      const list = await findOpportunities(
        {
          page: 1,
          page_size: 20,
          order_by: "rating",
          query: suffix,
        },
        context,
      );

      expect(list.items.some((item) => item.id === opportunityId)).toBe(true);
      const listedOpportunity = list.items.find((item) => item.id === opportunityId);
      expect(listedOpportunity?.is_selected).toBe(true);

      const opportunity = await findOpportunityById(opportunityId, context);
      expect(opportunity?.rating).toBeNull();

      const updated = await updateOpportunityRating(
        opportunityId,
        { rating: 3 },
        context,
      );
      expect(updated?.rating).toBe(3);

      const cleared = await updateOpportunityRating(
        opportunityId,
        { rating: null },
        context,
      );
      expect(cleared?.rating).toBeNull();

      const detail = await findBusinessById(businessId, context);
      expect(detail?.opportunity_selected).toBe(true);

      await updateBusinessLeadStatus(businessId, { status: "discarded" }, context);
      const discardedList = await findOpportunities(
        {
          page: 1,
          page_size: 20,
          order_by: "rating",
          query: suffix,
        },
        context,
      );
      expect(discardedList.items.some((item) => item.id === opportunityId)).toBe(false);
    } finally {
      await query("delete from businesses where id = $1", [businessId], {
        operationName: "cleanup_opportunity_business",
        context,
      });
    }
  });
});
