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
  const getOwnerUserId = async (): Promise<string> => {
    const result = await query<{ id: string }>(
      "select id from users where role = 'admin' order by created_at asc, id asc limit 1",
      [],
      {
        operationName: "integration_get_owner_user",
        context
      }
    );
    const id = result.rows[0]?.id;
    if (!id) {
      throw new Error("Expected at least one admin user for integration tests");
    }
    return id;
  };

  it("lists businesses through the repository contract", async () => {
    const ownerUserId = await getOwnerUserId();
    const result = await findBusinesses({
      page: 1,
      page_size: 20,
      order_by: "created_at",
    }, ownerUserId, context);

    expect(Array.isArray(result.items)).toBe(true);
    expect(result.page).toBe(1);
    expect(result.page_size).toBe(20);
    expect(result.total).toBeGreaterThanOrEqual(0);
  });

  it("returns null for a missing business id", async () => {
    const ownerUserId = await getOwnerUserId();
    const business = await findBusinessById(
      "00000000-0000-4000-8000-000000000000",
      ownerUserId,
      context,
    );

    expect(business).toBeNull();
  });

  it("creates and lists a search run through repository contracts", async () => {
    const suffix = randomUUID();
    const ownerUserId = await getOwnerUserId();
    const searchRun = await insertSearchRun(
      {
        query: `integration dentists ${suffix}`,
        location: "Buenos Aires, Argentina",
      },
      ownerUserId,
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
      }, ownerUserId, context);

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
    const ownerUserId = await getOwnerUserId();
    const insertResult = await query<{ id: string }>(
      `
        insert into businesses (
          owner_user_id,
          source,
          name,
          address,
          has_website,
          status,
          notes
        )
        values ($1::uuid, 'google_places', $2, $3, false, 'new', 'Initial note')
        returning id
      `,
      [ownerUserId, `Integration Business ${suffix}`, `Integration Address ${suffix}`],
      {
        operationName: "insert_integration_business",
        context,
      },
    );
    const id = insertResult.rows[0].id;

    try {
      const reviewed = await updateBusinessLeadStatus(
        id,
        ownerUserId,
        { status: "reviewed" },
        context
      );
      expect(reviewed?.status).toBe("reviewed");
      expect(reviewed?.notes).toBe("Initial note");

      const discarded = await updateBusinessLeadStatus(
        id,
        ownerUserId,
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
    const ownerUserId = await getOwnerUserId();
    const insertBusinessResult = await query<{ id: string }>(
      `
        insert into businesses (
          owner_user_id,
          source,
          name,
          address,
          city,
          has_website,
          status,
          notes
        )
        values ($1::uuid, 'google_places', $2, $3, 'Buenos Aires', false, 'new', 'Opportunity note')
        returning id
      `,
      [ownerUserId, `Opportunity Business ${suffix}`, `Opportunity Address ${suffix}`],
      {
        operationName: "insert_opportunity_business",
        context,
      },
    );
    const businessId = insertBusinessResult.rows[0].id;

    const insertOpportunityResult = await query<{ id: string }>(
      `
        insert into opportunities (business_id, rating, is_selected)
        values ($1, $2::uuid, null, true)
        returning id
      `,
      [businessId, ownerUserId],
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
        ownerUserId,
        context,
      );

      expect(list.items.some((item) => item.id === opportunityId)).toBe(true);
      const listedOpportunity = list.items.find((item) => item.id === opportunityId);
      expect(listedOpportunity?.is_selected).toBe(true);

      const opportunity = await findOpportunityById(opportunityId, ownerUserId, context);
      expect(opportunity?.rating).toBeNull();

      const updated = await updateOpportunityRating(
        opportunityId,
        ownerUserId,
        { rating: 3 },
        context,
      );
      expect(updated?.rating).toBe(3);

      const cleared = await updateOpportunityRating(
        opportunityId,
        ownerUserId,
        { rating: null },
        context,
      );
      expect(cleared?.rating).toBeNull();

      const detail = await findBusinessById(businessId, ownerUserId, context);
      expect(detail?.opportunity_selected).toBe(true);

      await updateBusinessLeadStatus(
        businessId,
        ownerUserId,
        { status: "discarded" },
        context
      );
      const discardedList = await findOpportunities(
        {
          page: 1,
          page_size: 20,
          order_by: "rating",
          query: suffix,
        },
        ownerUserId,
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
