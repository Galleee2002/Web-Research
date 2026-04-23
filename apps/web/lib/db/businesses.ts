import type {
  BusinessDetailRead,
  BusinessFilters,
  BusinessRead,
  BusinessStatusUpdate,
  PaginatedResponse
} from "@shared/index";

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
    clauses.push(`name ilike $${values.length}`);
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
  filters: BusinessFilters
): Promise<PaginatedResponse<BusinessRead>> {
  const listQuery = buildBusinessListQuery(filters);
  const countQuery = buildBusinessCountQuery(filters);
  const [itemsResult, countResult] = await Promise.all([
    query<BusinessRow>(listQuery.text, listQuery.values),
    query<{ total: number }>(countQuery.text, countQuery.values)
  ]);

  return {
    items: itemsResult.rows.map(mapBusiness),
    total: countResult.rows[0]?.total ?? 0,
    page: filters.page,
    page_size: filters.page_size
  };
}

export async function findBusinessesForExport(
  filters: BusinessFilters
): Promise<BusinessRead[]> {
  const exportQuery = buildBusinessExportQuery(filters);
  const result = await query<BusinessRow>(exportQuery.text, exportQuery.values);

  return result.rows.map(mapBusiness);
}

export async function findBusinessById(
  id: string
): Promise<BusinessDetailRead | null> {
  const result = await query<BusinessRow>(
    `
      select ${BUSINESS_SELECT}
      from businesses
      where id = $1
      limit 1
    `,
    [id]
  );

  return result.rows[0] ? mapBusinessDetail(result.rows[0]) : null;
}

export async function updateBusinessLeadStatus(
  id: string,
  payload: BusinessStatusUpdate
): Promise<BusinessDetailRead | null> {
  const result = await query<BusinessRow>(
    `
      update businesses
      set
        status = $2,
        notes = case when $3::boolean then $4::text else notes end,
        updated_at = now()
      where id = $1
      returning ${BUSINESS_SELECT}
    `,
    [id, payload.status, Object.hasOwn(payload, "notes"), payload.notes ?? null]
  );

  return result.rows[0] ? mapBusinessDetail(result.rows[0]) : null;
}
