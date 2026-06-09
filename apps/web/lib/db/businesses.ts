import type {
  BusinessCreate,
  BusinessDetailRead,
  BusinessFilters,
  BusinessRead,
  BusinessStatusUpdate,
  BusinessUpdate,
  LeadStatus,
  PaginatedResponse
} from "@shared/index";

import type { OperationContext } from "@/lib/api/http";

import { fallbackDedupKey } from "@/lib/domain/business-dedup";

import { ensureOpportunityForBusiness } from "./opportunities";
import { getPool, query } from "./pool";
import { toIsoString, whereSql } from "./shared-query";
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
  email: string | null;
  social_links: string[] | null;
  website: string | null;
  has_website: boolean;
  maps_url: string | null;
  status: BusinessRead["status"];
  notes: string | null;
  opportunity_selected?: boolean | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface ManualBusinessInsert {
  name: string;
  category: string | null;
  email: string | null;
  phone: string | null;
  social_links: string[];
  website: string | null;
  has_website: boolean;
  notes: string | null;
  address: string | null;
}

export interface BusinessFieldUpdate {
  name?: string;
  category?: string | null;
  email?: string | null;
  phone?: string | null;
  social_links?: string[];
  website?: string | null;
  has_website?: boolean;
  notes?: string | null;
  address?: string | null;
  status?: LeadStatus;
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
  email,
  social_links,
  website,
  has_website,
  maps_url,
  status,
  notes,
  created_at,
  updated_at
`;

const DEDUP_NAME_SQL = `
  regexp_replace(
    translate(
      lower(name),
      'áàâäãåéèêëíìîïóòôöõúùûüñç',
      'aaaaaaeeeeiiiiooooouuuunc'
    ),
    '[^a-z0-9]+',
    '',
    'g'
  )
`;

const DEDUP_ADDRESS_SQL = `
  regexp_replace(
    translate(
      lower(coalesce(address, '')),
      'áàâäãåéèêëíìîïóòôöõúùûüñç',
      'aaaaaaeeeeiiiiooooouuuunc'
    ),
    '[^a-z0-9]+',
    '',
    'g'
  )
`;

const ORDER_BY: Record<NonNullable<BusinessFilters["order_by"]>, string> = {
  created_at: "created_at desc",
  name: "name asc",
  city: "city asc"
};

function toNumber(value: string | number | null): number | null {
  if (value === null) {
    return null;
  }

  return typeof value === "number" ? value : Number(value);
}

function normalizeSocialLinks(value: string[] | null | undefined): string[] {
  return value ?? [];
}

export function mapBusiness(row: BusinessRow): BusinessRead {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    address: row.address,
    city: row.city,
    phone: row.phone,
    email: row.email,
    social_links: normalizeSocialLinks(row.social_links),
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

function businessDetailSelect(alias: string): string {
  return `
    ${alias}.id,
    ${alias}.search_run_id,
    ${alias}.external_id,
    ${alias}.source,
    ${alias}.name,
    ${alias}.category,
    ${alias}.address,
    ${alias}.city,
    ${alias}.region,
    ${alias}.country,
    ${alias}.lat,
    ${alias}.lng,
    ${alias}.phone,
    ${alias}.email,
    ${alias}.social_links,
    ${alias}.website,
    ${alias}.has_website,
    ${alias}.maps_url,
    ${alias}.status,
    ${alias}.notes,
    coalesce(opportunities.is_selected, false) as opportunity_selected,
    ${alias}.created_at,
    ${alias}.updated_at
  `;
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
        ${businessDetailSelect("businesses")}
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

export async function findManualBusinessDuplicate(
  name: string,
  address: string | null | undefined,
  context: OperationContext,
  excludeId?: string
): Promise<{ id: string } | null> {
  const dedupKey = fallbackDedupKey(name, address);
  if (!dedupKey) {
    return null;
  }

  const [nameKey, addressKey] = dedupKey;
  const values: unknown[] = ["manual", nameKey, addressKey];
  let excludeClause = "";

  if (excludeId) {
    values.push(excludeId);
    excludeClause = `and id <> $${values.length}::uuid`;
  }

  const result = await query<{ id: string }>(
    `
      select id
      from businesses
      where source = $1
        and external_id is null
        and ${DEDUP_NAME_SQL} = $2
        and ${DEDUP_ADDRESS_SQL} = $3
        ${excludeClause}
      order by created_at asc
      limit 1
    `,
    values,
    {
      operationName: "find_manual_business_duplicate",
      context
    }
  );

  return result.rows[0] ?? null;
}

export async function insertManualBusiness(
  payload: ManualBusinessInsert,
  context: OperationContext
): Promise<BusinessDetailRead> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const insertResult = await client.query<{ id: string }>(
      `
        insert into businesses (
          source,
          name,
          category,
          email,
          phone,
          social_links,
          website,
          has_website,
          notes,
          address
        )
        values ('manual', $1, $2, $3, $4, $5::text[], $6, $7, $8, $9)
        returning id
      `,
      [
        payload.name,
        payload.category,
        payload.email,
        payload.phone,
        payload.social_links,
        payload.website,
        payload.has_website,
        payload.notes,
        payload.address
      ]
    );

    const businessId = insertResult.rows[0]?.id;
    if (!businessId) {
      throw new Error("insert_manual_business did not return an id");
    }

    if (!payload.has_website) {
      await client.query(
        `
          insert into opportunities (business_id, rating, is_selected)
          values ($1, null, false)
          on conflict (business_id) do nothing
        `,
        [businessId]
      );
    }

    await client.query("COMMIT");

    const created = await findBusinessById(businessId, context);
    if (!created) {
      throw new Error("insert_manual_business could not reload created business");
    }

    return created;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateBusinessFields(
  id: string,
  fields: BusinessFieldUpdate,
  context: OperationContext
): Promise<BusinessDetailRead | null> {
  const setClauses: string[] = [];
  const values: unknown[] = [id];

  const addSet = (column: string, value: unknown) => {
    values.push(value);
    setClauses.push(`${column} = $${values.length}`);
  };

  if (fields.name !== undefined) {
    addSet("name", fields.name);
  }
  if (fields.category !== undefined) {
    addSet("category", fields.category);
  }
  if (fields.email !== undefined) {
    addSet("email", fields.email);
  }
  if (fields.phone !== undefined) {
    addSet("phone", fields.phone);
  }
  if (fields.social_links !== undefined) {
    values.push(fields.social_links);
    setClauses.push(`social_links = $${values.length}::text[]`);
  }
  if (fields.website !== undefined) {
    addSet("website", fields.website);
  }
  if (fields.has_website !== undefined) {
    addSet("has_website", fields.has_website);
  }
  if (fields.notes !== undefined) {
    addSet("notes", fields.notes);
  }
  if (fields.address !== undefined) {
    addSet("address", fields.address);
  }
  if (fields.status !== undefined) {
    addSet("status", fields.status);
  }

  if (setClauses.length === 0) {
    return findBusinessById(id, context);
  }

  setClauses.push("updated_at = now()");

  const result = await query<BusinessRow>(
    `
      with updated_business as (
        update businesses
        set ${setClauses.join(", ")}
        where id = $1
        returning *
      )
      select
        ${businessDetailSelect("updated_business")}
      from updated_business
      left join opportunities on opportunities.business_id = updated_business.id
    `,
    values,
    {
      operationName: "update_business_fields",
      context
    }
  );

  const updated = result.rows[0] ? mapBusinessDetail(result.rows[0]) : null;

  if (updated && updated.has_website === false) {
    await ensureOpportunityForBusiness(id, context);
  }

  return updated;
}

export async function updateBusinessLeadStatus(
  id: string,
  payload: BusinessStatusUpdate,
  context: OperationContext
): Promise<BusinessDetailRead | null> {
  return updateBusinessFields(
    id,
    {
      status: payload.status,
      ...(Object.hasOwn(payload, "notes") ? { notes: payload.notes ?? null } : {})
    },
    context
  );
}

export function buildManualBusinessInsert(
  payload: BusinessCreate,
  website: string | null,
  hasWebsite: boolean
): ManualBusinessInsert {
  return {
    name: payload.name,
    category: payload.category ?? null,
    email: payload.email ?? null,
    phone: payload.phone ?? null,
    social_links: payload.social_links ?? [],
    website,
    has_website: hasWebsite,
    notes: payload.notes ?? null,
    address: payload.address ?? null
  };
}

export function buildBusinessFieldUpdate(
  payload: BusinessUpdate,
  website?: string | null,
  hasWebsite?: boolean
): BusinessFieldUpdate {
  const fields: BusinessFieldUpdate = {};

  if (payload.name !== undefined) fields.name = payload.name;
  if (payload.category !== undefined) fields.category = payload.category;
  if (payload.email !== undefined) fields.email = payload.email;
  if (payload.phone !== undefined) fields.phone = payload.phone;
  if (payload.social_links !== undefined) {
    fields.social_links = payload.social_links ?? [];
  }
  if (payload.notes !== undefined) fields.notes = payload.notes;
  if (payload.address !== undefined) fields.address = payload.address;
  if (payload.status !== undefined) fields.status = payload.status;
  if (website !== undefined) fields.website = website;
  if (hasWebsite !== undefined) fields.has_website = hasWebsite;

  return fields;
}
