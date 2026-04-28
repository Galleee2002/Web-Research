import type {
  BusinessDetailRead,
  BusinessFilters,
  BusinessRead,
  BusinessStatusUpdate,
  PaginatedResponse
} from "@shared/index";

import type { OperationContext } from "@/lib/api/http";

import { query } from "./pool";
import type { SqlQuery } from "./searches";

interface BusinessRow {
  id: string;
  search_run_id: string | null;
  external_id: string | null;
  source: BusinessDetailRead["source"];
  name: string;
  category: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  lat: string | number | null;
  lng: string | number | null;
  phone: string | null;
  website: string | null;
  has_website: boolean;
  maps_url: string | null;
  status: BusinessRead["status"];
  notes: string | null;
  opportunity_selected?: boolean | null;
  created_at: Date | string;
  updated_at: Date | string;
}

const BUSINESS_SELECT = `
  id,
  search_run_id,
  external_id,
  source,
  name,
  category,
  address,
  city,
  region,
  country,
  lat,
  lng,
  phone,
  website,
  has_website,
  maps_url,
  status,
  notes,
  created_at,
  updated_at
`;

const ORDER_BY: Record<NonNullable<BusinessFilters["order_by"]>, string> = {
  created_at: "created_at desc",
  name: "name asc",
  city: "city asc"
};

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toNumber(value: string | number | null): number | null {
  if (value === null) {
    return null;
  }

  return typeof value === "number" ? value : Number(value);
}

export function mapBusiness(row: BusinessRow): BusinessRead {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    address: row.address,
    city: row.city,
    phone: row.phone,
    website: row.website,
    has_website: row.has_website,
    status: row.status,
    maps_url: row.maps_url
  };
}

export function mapBusinessDetail(row: BusinessRow): BusinessDetailRead {
  return {
    ...mapBusiness(row),
    search_run_id: row.search_run_id,
    external_id: row.external_id,
    source: row.source,
    region: row.region,
    country: row.country,
    lat: toNumber(row.lat),
    lng: toNumber(row.lng),
    notes: row.notes,
    opportunity_selected: row.opportunity_selected ?? false,
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at)
  };
}

function buildBusinessWhere(filters: BusinessFilters): {
  clauses: string[];
  values: unknown[];
} {
  const clauses: string[] = [];
  const values: unknown[] = [];

  if (filters.has_website !== undefined) {
    values.push(filters.has_website);
    clauses.push(`has_website = $${values.length}`);
  }

  if (filters.status !== undefined) {
    values.push(filters.status);
    clauses.push(`status = $${values.length}`);
  }

  if (filters.city !== undefined) {
    values.push(filters.city);
    clauses.push(`city = $${values.length}`);
  }

  if (filters.category !== undefined) {
    values.push(filters.category);
    clauses.push(`category = $${values.length}`);
  }

  if (filters.query !== undefined) {
    values.push(`%${filters.query}%`);
    const queryParam = values.length;
    clauses.push(
      `(name ilike $${queryParam} OR id::text ilike $${queryParam})`
    );
  }

  if (filters.search_run_id !== undefined) {
    values.push(filters.search_run_id);
    clauses.push(`search_run_id = $${values.length}::uuid`);
  }

  return { clauses, values };
}

function whereSql(clauses: string[]): string {
  return clauses.length > 0 ? `where ${clauses.join(" and ")}` : "";
}

export function buildBusinessListQuery(filters: BusinessFilters): SqlQuery {
  const { clauses, values } = buildBusinessWhere(filters);
  const limitPosition = values.length + 1;
  const offsetPosition = values.length + 2;
  const orderBy = ORDER_BY[filters.order_by ?? "created_at"];

  values.push(filters.page_size, (filters.page - 1) * filters.page_size);

  return {
    text: `
      select ${BUSINESS_SELECT}
      from businesses
      ${whereSql(clauses)}
      order by ${orderBy}
      limit $${limitPosition} offset $${offsetPosition}
    `,
    values
  };
}

export function buildBusinessCountQuery(filters: BusinessFilters): SqlQuery {
  const { clauses, values } = buildBusinessWhere(filters);

  return {
    text: `
      select count(*)::int as total
      from businesses
      ${whereSql(clauses)}
    `,
    values
  };
}

export function buildBusinessExportQuery(filters: BusinessFilters): SqlQuery {
  const { clauses, values } = buildBusinessWhere(filters);
  const orderBy = ORDER_BY[filters.order_by ?? "created_at"];

  return {
    text: `
      select ${BUSINESS_SELECT}
      from businesses
      ${whereSql(clauses)}
      order by ${orderBy}
    `,
    values
  };
}

export async function findBusinesses(
  filters: BusinessFilters,
  context: OperationContext
): Promise<PaginatedResponse<BusinessRead>> {
  const listQuery = buildBusinessListQuery(filters);
  const countQuery = buildBusinessCountQuery(filters);
  const [itemsResult, countResult] = await Promise.all([
    query<BusinessRow>(listQuery.text, listQuery.values, {
      operationName: "find_businesses",
      context
    }),
    query<{ total: number }>(countQuery.text, countQuery.values, {
      operationName: "count_businesses",
      context
    })
  ]);

  return {
    items: itemsResult.rows.map(mapBusiness),
    total: countResult.rows[0]?.total ?? 0,
    page: filters.page,
    page_size: filters.page_size
  };
}

export async function findBusinessesForExport(
  filters: BusinessFilters,
  context: OperationContext
): Promise<BusinessRead[]> {
  const exportQuery = buildBusinessExportQuery(filters);
  const result = await query<BusinessRow>(exportQuery.text, exportQuery.values, {
    operationName: "export_businesses",
    context
  });

  return result.rows.map(mapBusiness);
}

export async function findBusinessById(
  id: string,
  context: OperationContext
): Promise<BusinessDetailRead | null> {
  const result = await query<BusinessRow>(
    `
      select
        businesses.id,
        businesses.search_run_id,
        businesses.external_id,
        businesses.source,
        businesses.name,
        businesses.category,
        businesses.address,
        businesses.city,
        businesses.region,
        businesses.country,
        businesses.lat,
        businesses.lng,
        businesses.phone,
        businesses.website,
        businesses.has_website,
        businesses.maps_url,
        businesses.status,
        businesses.notes,
        businesses.created_at,
        businesses.updated_at,
        coalesce(opportunities.is_selected, false) as opportunity_selected
      from businesses
      left join opportunities on opportunities.business_id = businesses.id
      where businesses.id = $1
      limit 1
    `,
    [id],
    {
      operationName: "find_business_by_id",
      context
    }
  );

  return result.rows[0] ? mapBusinessDetail(result.rows[0]) : null;
}

export async function updateBusinessLeadStatus(
  id: string,
  payload: BusinessStatusUpdate,
  context: OperationContext
): Promise<BusinessDetailRead | null> {
  const result = await query<BusinessRow>(
    `
      with updated_business as (
        update businesses
        set
          status = $2,
          notes = case when $3::boolean then $4::text else notes end,
          updated_at = now()
        where id = $1
        returning *
      )
      select
        updated_business.id,
        updated_business.search_run_id,
        updated_business.external_id,
        updated_business.source,
        updated_business.name,
        updated_business.category,
        updated_business.address,
        updated_business.city,
        updated_business.region,
        updated_business.country,
        updated_business.lat,
        updated_business.lng,
        updated_business.phone,
        updated_business.website,
        updated_business.has_website,
        updated_business.maps_url,
        updated_business.status,
        updated_business.notes,
        coalesce(opportunities.is_selected, false) as opportunity_selected,
        updated_business.created_at,
        updated_business.updated_at
      from updated_business
      left join opportunities on opportunities.business_id = updated_business.id
    `,
    [id, payload.status, Object.hasOwn(payload, "notes"), payload.notes ?? null],
    {
      operationName: "update_business_status",
      context
    }
  );

  return result.rows[0] ? mapBusinessDetail(result.rows[0]) : null;
}
