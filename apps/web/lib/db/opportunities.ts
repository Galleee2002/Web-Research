import type {
  OpportunityDetailRead,
  OpportunityFilters,
  OpportunityRatingUpdate,
  OpportunitySelectionResult,
  OpportunitySelectionUpdate,
  OpportunityUpdate,
  OpportunityRead,
  PaginatedResponse,
} from "@shared/index";

import type { OperationContext } from "@/lib/api/http";

import { query } from "./pool";
import { toIsoString, whereSql } from "./shared-query";
import type { SqlQuery } from "./searches";

interface OpportunityRow {
  id: string;
  business_id: string;
  is_selected: boolean;
  rating: number | null;
  name: string;
  category: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  website: string | null;
  has_website: boolean;
  status: OpportunityRead["status"];
  maps_url: string | null;
  notes: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

const OPPORTUNITY_SELECT = `
  opportunities.id,
  opportunities.business_id,
  opportunities.is_selected,
  opportunities.rating,
  businesses.name,
  businesses.category,
  businesses.address,
  businesses.city,
  businesses.phone,
  businesses.website,
  businesses.has_website,
  businesses.status,
  businesses.maps_url,
  businesses.notes,
  opportunities.created_at,
  opportunities.updated_at
`;

const ORDER_BY: Record<NonNullable<OpportunityFilters["order_by"]>, string> = {
  rating: "opportunities.rating desc nulls last, opportunities.created_at desc, opportunities.id asc",
  created_at: "opportunities.created_at desc, opportunities.id asc",
  name: "businesses.name asc, opportunities.created_at desc, opportunities.id asc",
  city: "businesses.city asc nulls last, opportunities.created_at desc, opportunities.id asc",
};

function mapOpportunity(row: OpportunityRow): OpportunityRead {
  return {
    id: row.id,
    business_id: row.business_id,
    is_selected: row.is_selected,
    rating: row.rating as OpportunityRead["rating"],
    name: row.name,
    category: row.category,
    address: row.address,
    city: row.city,
    phone: row.phone,
    website: row.website,
    has_website: row.has_website,
    status: row.status,
    maps_url: row.maps_url,
    notes: row.notes,
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
  };
}

function mapOpportunityDetail(row: OpportunityRow): OpportunityDetailRead {
  return {
    ...mapOpportunity(row),
    notes: row.notes,
  };
}

function buildOpportunityWhere(filters: OpportunityFilters): {
  clauses: string[];
  values: unknown[];
} {
  const clauses = [
    "opportunities.is_selected = true",
    "businesses.has_website = false",
    "businesses.status <> 'discarded'",
  ];
  const values: unknown[] = [];

  if (filters.status !== undefined) {
    values.push(filters.status);
    clauses.push(`businesses.status = $${values.length}`);
  }

  if (filters.city !== undefined) {
    values.push(filters.city);
    clauses.push(`businesses.city = $${values.length}`);
  }

  if (filters.category !== undefined) {
    values.push(filters.category);
    clauses.push(`businesses.category = $${values.length}`);
  }

  if (filters.query !== undefined) {
    values.push(`%${filters.query}%`);
    clauses.push(`businesses.name ilike $${values.length}`);
  }

  return { clauses, values };
}

export function buildOpportunityListQuery(filters: OpportunityFilters): SqlQuery {
  const { clauses, values } = buildOpportunityWhere(filters);
  const limitPosition = values.length + 1;
  const offsetPosition = values.length + 2;
  const orderBy = ORDER_BY[filters.order_by ?? "rating"];

  values.push(filters.page_size, (filters.page - 1) * filters.page_size);

  return {
    text: `
      select ${OPPORTUNITY_SELECT}
      from opportunities
      inner join businesses on businesses.id = opportunities.business_id
      ${whereSql(clauses)}
      order by ${orderBy}
      limit $${limitPosition} offset $${offsetPosition}
    `,
    values,
  };
}

export function buildOpportunityCountQuery(filters: OpportunityFilters): SqlQuery {
  const { clauses, values } = buildOpportunityWhere(filters);

  return {
    text: `
      select count(*)::int as total
      from opportunities
      inner join businesses on businesses.id = opportunities.business_id
      ${whereSql(clauses)}
    `,
    values,
  };
}

export async function findOpportunities(
  filters: OpportunityFilters,
  context: OperationContext,
): Promise<PaginatedResponse<OpportunityRead>> {
  const listQuery = buildOpportunityListQuery(filters);
  const countQuery = buildOpportunityCountQuery(filters);
  const [itemsResult, countResult] = await Promise.all([
    query<OpportunityRow>(listQuery.text, listQuery.values, {
      operationName: "find_opportunities",
      context,
    }),
    query<{ total: number }>(countQuery.text, countQuery.values, {
      operationName: "count_opportunities",
      context,
    }),
  ]);

  return {
    items: itemsResult.rows.map(mapOpportunity),
    total: countResult.rows[0]?.total ?? 0,
    page: filters.page,
    page_size: filters.page_size,
  };
}

export async function findOpportunityById(
  id: string,
  context: OperationContext,
): Promise<OpportunityDetailRead | null> {
  const result = await query<OpportunityRow>(
    `
      select ${OPPORTUNITY_SELECT}
      from opportunities
      inner join businesses on businesses.id = opportunities.business_id
      where opportunities.id = $1
      limit 1
    `,
    [id],
    {
      operationName: "find_opportunity_by_id",
      context,
    },
  );

  return result.rows[0] ? mapOpportunityDetail(result.rows[0]) : null;
}

export async function updateOpportunityRating(
  id: string,
  payload: OpportunityRatingUpdate,
  context: OperationContext,
): Promise<OpportunityDetailRead | null> {
  const result = await query<OpportunityRow>(
    `
      update opportunities
      set
        rating = $2,
        updated_at = now()
      from businesses
      where opportunities.id = $1
        and businesses.id = opportunities.business_id
      returning ${OPPORTUNITY_SELECT}
    `,
    [id, payload.rating],
    {
      operationName: "update_opportunity_rating",
      context,
    },
  );

  return result.rows[0] ? mapOpportunityDetail(result.rows[0]) : null;
}

export async function updateOpportunity(
  id: string,
  payload: OpportunityUpdate,
  context: OperationContext,
): Promise<OpportunityDetailRead | null> {
  const hasRating = Object.hasOwn(payload, "rating");
  const hasStatus = Object.hasOwn(payload, "status");
  const hasNotes = Object.hasOwn(payload, "notes");

  const result = await query<OpportunityRow>(
    `
      with target as (
        select opportunities.id as opportunity_id, opportunities.business_id
        from opportunities
        inner join businesses on businesses.id = opportunities.business_id
        where opportunities.id = $1
      ),
      update_opportunity as (
        update opportunities
        set
          rating = case when $2::boolean then $3 else opportunities.rating end,
          is_selected = case
            when $4::boolean and $5::text = 'discarded' then false
            else opportunities.is_selected
          end,
          updated_at = case
            when $4::boolean
              and $5::text = 'discarded'
              and opportunities.is_selected is distinct from false then now()
            when $2::boolean and opportunities.rating is distinct from $3 then now()
            else opportunities.updated_at
          end
        from target
        where opportunities.id = target.opportunity_id
      ),
      update_business as (
        update businesses
        set
          status = case when $4::boolean then $5 else businesses.status end,
          notes = case when $6::boolean then $7 else businesses.notes end,
          updated_at = case
            when $4::boolean and businesses.status is distinct from $5 then now()
            when $6::boolean and businesses.notes is distinct from $7 then now()
            else businesses.updated_at
          end
        from target
        where businesses.id = target.business_id
      )
      select ${OPPORTUNITY_SELECT}
      from opportunities
      inner join businesses on businesses.id = opportunities.business_id
      where opportunities.id = $1
      limit 1
    `,
    [
      id,
      hasRating,
      payload.rating ?? null,
      hasStatus,
      payload.status ?? null,
      hasNotes,
      payload.notes ?? null,
    ],
    {
      operationName: "update_opportunity",
      context,
    },
  );

  return result.rows[0] ? mapOpportunityDetail(result.rows[0]) : null;
}

interface OpportunitySelectionRow {
  opportunity_id: string;
  business_id: string;
  is_selected: boolean;
  updated_at: Date | string;
}

export async function setOpportunitySelectionByBusinessId(
  businessId: string,
  payload: OpportunitySelectionUpdate,
  context: OperationContext,
): Promise<OpportunitySelectionResult | null> {
  const result = await query<OpportunitySelectionRow>(
    `
      with existing_business as (
        select id
        from businesses
        where id = $1
        limit 1
      ),
      upserted as (
        insert into opportunities (business_id, rating, is_selected)
        select id, null, $2
        from existing_business
        on conflict (business_id) do update
          set is_selected = excluded.is_selected,
              updated_at = now()
        returning id, business_id, is_selected, updated_at
      )
      select
        upserted.id as opportunity_id,
        upserted.business_id,
        upserted.is_selected,
        upserted.updated_at
      from upserted
      limit 1
    `,
    [businessId, payload.is_selected],
    {
      operationName: "set_opportunity_selection_by_business_id",
      context,
    },
  );

  if (!result.rows[0]) {
    return null;
  }

  return {
    opportunity_id: result.rows[0].opportunity_id,
    business_id: result.rows[0].business_id,
    is_selected: result.rows[0].is_selected,
    updated_at: toIsoString(result.rows[0].updated_at),
  };
}
