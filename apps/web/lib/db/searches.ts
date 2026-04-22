import { DEFAULT_BUSINESS_SOURCE } from "@shared/constants/domain";
import type { BusinessSource } from "@shared/constants/domain";
import type {
  PaginatedResponse,
  SearchCreate,
  SearchFilters,
  SearchRead
} from "@shared/types/search";

import { query } from "./pool";

interface SearchRunRow {
  id: string;
  query: string;
  location: string;
  source: BusinessSource;
  status: SearchRead["status"];
  total_found: number;
  created_at: Date | string;
}

export interface SqlQuery {
  text: string;
  values: unknown[];
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function mapSearchRun(row: SearchRunRow): SearchRead {
  return {
    id: row.id,
    query: row.query,
    location: row.location,
    source: row.source,
    status: row.status,
    total_found: row.total_found,
    created_at: toIsoString(row.created_at)
  };
}

function buildSearchWhere(filters: SearchFilters): {
  clauses: string[];
  values: unknown[];
} {
  const clauses: string[] = [];
  const values: unknown[] = [];

  if (filters.status !== undefined) {
    values.push(filters.status);
    clauses.push(`status = $${values.length}`);
  }

  const source = filters.source ?? DEFAULT_BUSINESS_SOURCE;
  values.push(source);
  clauses.push(`source = $${values.length}`);

  return { clauses, values };
}

export function buildSearchListQuery(filters: SearchFilters): SqlQuery {
  const { clauses, values } = buildSearchWhere(filters);
  const limitPosition = values.length + 1;
  const offsetPosition = values.length + 2;

  values.push(filters.page_size, (filters.page - 1) * filters.page_size);

  return {
    text: `
      select id, query, location, source, status, total_found, created_at
      from search_runs
      where ${clauses.join(" and ")}
      order by created_at desc
      limit $${limitPosition} offset $${offsetPosition}
    `,
    values
  };
}

export function buildSearchCountQuery(filters: SearchFilters): SqlQuery {
  const { clauses, values } = buildSearchWhere(filters);

  return {
    text: `
      select count(*)::int as total
      from search_runs
      where ${clauses.join(" and ")}
    `,
    values
  };
}

export async function createSearchRun(payload: SearchCreate): Promise<SearchRead> {
  const result = await query<SearchRunRow>(
    `
      insert into search_runs (query, location, source, status, total_found)
      values ($1, $2, $3, 'pending', 0)
      returning id, query, location, source, status, total_found, created_at
    `,
    [payload.query, payload.location, DEFAULT_BUSINESS_SOURCE]
  );

  return mapSearchRun(result.rows[0]);
}

export async function listSearchRuns(
  filters: SearchFilters
): Promise<PaginatedResponse<SearchRead>> {
  const listQuery = buildSearchListQuery(filters);
  const countQuery = buildSearchCountQuery(filters);
  const [itemsResult, countResult] = await Promise.all([
    query<SearchRunRow>(listQuery.text, listQuery.values),
    query<{ total: number }>(countQuery.text, countQuery.values)
  ]);

  return {
    items: itemsResult.rows.map(mapSearchRun),
    total: countResult.rows[0]?.total ?? 0,
    page: filters.page,
    page_size: filters.page_size
  };
}
