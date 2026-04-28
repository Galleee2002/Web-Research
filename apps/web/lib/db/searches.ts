import { DEFAULT_BUSINESS_SOURCE } from "@shared/constants/domain";
import type { BusinessSource } from "@shared/constants/domain";
import type {
  PaginatedResponse,
  SearchCreate,
  SearchFilters,
  SearchRead
} from "@shared/types/search";

import type { OperationContext } from "@/lib/api/http";

import { query } from "./pool";
import { toIsoString, whereSql } from "./shared-query";

interface SearchRunRow {
  id: string;
  query: string;
  location: string;
  source: BusinessSource;
  status: SearchRead["status"];
  total_found: number;
  parent_search_run_id: string | null;
  page_number: number;
  provider_page_token: string | null;
  provider_next_page_token: string | null;
  created_at: Date | string;
}

export interface SearchRunRecord extends SearchRead {
  provider_page_token: string | null;
  provider_next_page_token: string | null;
}

export interface SqlQuery {
  text: string;
  values: unknown[];
}

const SEARCH_RUN_SELECT = `
  id,
  query,
  location,
  source,
  status,
  total_found,
  parent_search_run_id,
  page_number,
  provider_page_token,
  provider_next_page_token,
  created_at
`;

function mapSearchRunBase(row: SearchRunRow): SearchRunRecord {
  return {
    id: row.id,
    query: row.query,
    location: row.location,
    source: row.source,
    status: row.status,
    total_found: row.total_found,
    parent_search_run_id: row.parent_search_run_id,
    page_number: row.page_number,
    provider_next_page_available:
      typeof row.provider_next_page_token === "string" &&
      row.provider_next_page_token.trim().length > 0,
    provider_page_token: row.provider_page_token,
    provider_next_page_token: row.provider_next_page_token,
    created_at: toIsoString(row.created_at)
  };
}

export function mapSearchRun(row: SearchRunRow): SearchRead {
  const mapped = mapSearchRunBase(row);
  return {
    id: mapped.id,
    query: mapped.query,
    location: mapped.location,
    source: mapped.source,
    status: mapped.status,
    total_found: mapped.total_found,
    parent_search_run_id: mapped.parent_search_run_id,
    page_number: mapped.page_number,
    provider_next_page_available: mapped.provider_next_page_available,
    created_at: mapped.created_at
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
      select ${SEARCH_RUN_SELECT}
      from search_runs
      ${whereSql(clauses)}
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
      ${whereSql(clauses)}
    `,
    values
  };
}

export async function insertSearchRun(
  payload: SearchCreate,
  context: OperationContext
): Promise<SearchRead> {
  const result = await query<SearchRunRow>(
    `
      insert into search_runs (
        query,
        location,
        source,
        status,
        total_found,
        page_number,
        correlation_id,
        observability
      )
      values ($1, $2, $3, 'pending', 0, 1, $4, $5::jsonb)
      returning ${SEARCH_RUN_SELECT}
    `,
    [
      payload.query,
      payload.location,
      DEFAULT_BUSINESS_SOURCE,
      context.correlationId,
      JSON.stringify({
        request_method: context.method,
        request_path: context.route,
        provider: DEFAULT_BUSINESS_SOURCE,
        page_number: 1,
        pagination_mode: "initial"
      })
    ],
    {
      operationName: "insert_search_run",
      context
    }
  );

  return mapSearchRun(result.rows[0]);
}

export async function findSearchRuns(
  filters: SearchFilters,
  context: OperationContext
): Promise<PaginatedResponse<SearchRead>> {
  const listQuery = buildSearchListQuery(filters);
  const countQuery = buildSearchCountQuery(filters);
  const [itemsResult, countResult] = await Promise.all([
    query<SearchRunRow>(listQuery.text, listQuery.values, {
      operationName: "find_search_runs",
      context
    }),
    query<{ total: number }>(countQuery.text, countQuery.values, {
      operationName: "count_search_runs",
      context
    })
  ]);

  return {
    items: itemsResult.rows.map(mapSearchRun),
    total: countResult.rows[0]?.total ?? 0,
    page: filters.page,
    page_size: filters.page_size
  };
}

export async function findSearchRunRecordById(
  id: string,
  context: OperationContext
): Promise<SearchRunRecord | null> {
  const result = await query<SearchRunRow>(
    `
      select ${SEARCH_RUN_SELECT}
      from search_runs
      where id = $1::uuid
      limit 1
    `,
    [id],
    {
      operationName: "find_search_run_by_id",
      context
    }
  );

  const row = result.rows[0];
  return row ? mapSearchRunBase(row) : null;
}

export async function findSearchRunByParentId(
  parentSearchRunId: string,
  context: OperationContext
): Promise<SearchRead | null> {
  const result = await query<SearchRunRow>(
    `
      select ${SEARCH_RUN_SELECT}
      from search_runs
      where parent_search_run_id = $1::uuid
      order by created_at desc
      limit 1
    `,
    [parentSearchRunId],
    {
      operationName: "find_search_run_by_parent_id",
      context
    }
  );

  const row = result.rows[0];
  return row ? mapSearchRun(row) : null;
}

export async function insertNextSearchRunFromParent(
  parent: SearchRunRecord,
  context: OperationContext
): Promise<{ searchRun: SearchRead; created: boolean }> {
  const observability = JSON.stringify({
    request_method: context.method,
    request_path: context.route,
    provider: parent.source,
    page_number: parent.page_number + 1,
    parent_search_run_id: parent.id,
    pagination_mode: "next_page"
  });

  const inserted = await query<SearchRunRow>(
    `
      insert into search_runs (
        query,
        location,
        source,
        status,
        total_found,
        parent_search_run_id,
        page_number,
        provider_page_token,
        correlation_id,
        observability
      )
      values (
        $1,
        $2,
        $3,
        'pending',
        0,
        $4::uuid,
        $5,
        $6,
        $7,
        $8::jsonb
      )
      on conflict (parent_search_run_id)
      where parent_search_run_id is not null
      do nothing
      returning ${SEARCH_RUN_SELECT}
    `,
    [
      parent.query,
      parent.location,
      parent.source,
      parent.id,
      parent.page_number + 1,
      parent.provider_next_page_token,
      context.correlationId,
      observability
    ],
    {
      operationName: "insert_next_search_run_from_parent",
      context
    }
  );

  const createdRow = inserted.rows[0];
  if (createdRow) {
    return { searchRun: mapSearchRun(createdRow), created: true };
  }

  const existing = await findSearchRunByParentId(parent.id, context);
  if (!existing) {
    throw new Error("Failed to resolve child search run after idempotent insert");
  }

  return { searchRun: existing, created: false };
}
