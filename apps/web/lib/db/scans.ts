import type { ScanListItem, ScanFilters } from "@shared/index";
import type { OperationContext } from "@/lib/api/http";
import { query } from "./pool";

interface SearchRunRow {
  id: string;
  provider: string | null;
  started_at: Date | string | null;
  completed_at: Date | string | null;
  error_code: string | null;
  correlation_id: string | null;
  observability: Record<string, unknown>;
  status: string;
}

export async function getProviderCalls(
  filters: ScanFilters,
  context: OperationContext
): Promise<{ rows: ScanListItem[]; total: number }> {
  const { page, page_size, provider, status, from, to } = filters;
  const offset = (page - 1) * page_size;
  const limit = page_size;

  const whereClauses: string[] = [];
  const params: unknown[] = [];

  // Filtrar solo registros con source (provider)
  whereClauses.push(`source IS NOT NULL`);

  if (provider) {
    whereClauses.push(`source = $${params.length + 1}`);
    params.push(provider);
  }

  if (status) {
    whereClauses.push(`status = $${params.length + 1}`);
    params.push(status);
  }

  if (from) {
    whereClauses.push(`started_at >= $${params.length + 1}::timestamptz`);
    params.push(from);
  }

  if (to) {
    whereClauses.push(`started_at <= $${params.length + 1}::timestamptz`);
    params.push(to);
  }

  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  // Obtener total
  const countResult = await query(
    `SELECT COUNT(*) as total FROM search_runs ${whereClause}`,
    params
  );
  const total = parseInt((countResult.rows[0] as { total: string }).total, 10);

  // Obtener items paginados
  const sql = `
    SELECT
      id,
      source as provider,
      source as provider_endpoint,
      started_at,
      finished_at as completed_at,
      error_code,
      correlation_id,
      observability,
      status
    FROM search_runs
    ${whereClause}
    ORDER BY started_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  params.push(limit, offset);

  const result = await query(sql, params);
  const rows = (result.rows as SearchRunRow[]).map((row) => ({
    id: row.id,
    searchRunId: row.id,
    provider: row.provider,
    providerEndpoint: row.provider,
    httpStatus: null,
    startedAt: row.started_at ? new Date(row.started_at).toISOString() : null,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    errorCode: row.error_code,
    correlationId: row.correlation_id,
    observability: row.observability || {},
  }));

  return { rows, total };
}

export async function countGlobalRequestsDaily(
  date?: string,
  context?: OperationContext
): Promise<number> {
  const params: unknown[] = [];
  let dateCondition = `started_at::date = CURRENT_DATE`;

  if (date) {
    dateCondition = `started_at::date = $1::date`;
    params.push(date);
  }

  const result = await query(
    `SELECT COUNT(*) as count FROM search_runs 
     WHERE source IS NOT NULL 
     AND ${dateCondition}`,
    params
  );

  return parseInt((result.rows[0] as { count: string }).count, 10);
}
