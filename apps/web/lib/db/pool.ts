import pg from "pg";

import { logError, logInfo } from "@/lib/api/logger";

import { DatabaseOperationError, type OperationContext } from "@/lib/api/http";

const { Pool } = pg;

let pool: pg.Pool | undefined;

export function getPool(): pg.Pool {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  pool ??= new Pool({ connectionString });
  return pool;
}

export async function query<T extends pg.QueryResultRow>(
  text: string,
  values: unknown[] = [],
  options?: {
    operationName?: string;
    context?: OperationContext;
  }
): Promise<pg.QueryResult<T>> {
  const startedAt = Date.now();
  const operationName = options?.operationName ?? "unnamed_query";

  try {
    const result = await getPool().query<T>(text, values);

    logInfo("db_query_succeeded", {
      correlation_id: options?.context?.correlationId,
      route: options?.context?.route,
      method: options?.context?.method,
      search_run_id: null,
      status_code: null,
      provider: null,
      error_code: null,
      error_stage: "persist",
      duration_ms: Date.now() - startedAt,
      result_count: result.rowCount ?? 0,
      operation: operationName
    });

    return result;
  } catch (error) {
    logError("db_query_failed", {
      correlation_id: options?.context?.correlationId,
      route: options?.context?.route,
      method: options?.context?.method,
      search_run_id: null,
      status_code: null,
      provider: null,
      error_code: "database_error",
      error_stage: "persist",
      duration_ms: Date.now() - startedAt,
      result_count: null,
      operation: operationName,
      error_message: error instanceof Error ? error.message : "Unknown database error"
    });

    throw new DatabaseOperationError(operationName, error);
  }
}
