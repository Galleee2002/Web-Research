import { Client } from "pg";

import { corsPreflight, logApiEvent, withApiRoute } from "@/lib/api/http";
import type { OperationContext } from "@/lib/api/http";
import { getRuntimeConfig } from "@/lib/config/runtime";

type DatabaseHealth =
  | {
      configured: false;
      reachable: null;
    }
  | {
      configured: true;
      reachable: boolean;
      error?: string;
    };

type HealthResponse = {
  app: "business-lead-finder";
  environment: string;
  timestamp: string;
  database: DatabaseHealth;
};

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

async function checkDatabase(context: OperationContext): Promise<DatabaseHealth> {
  const config = getRuntimeConfig();
  const connectionString = config.databaseUrl;

  if (!connectionString) {
    return {
      configured: false,
      reachable: null
    };
  }

  const client = new Client({
    connectionString,
    connectionTimeoutMillis: config.dbConnectionTimeoutMs
  });

  try {
    await client.connect();
    await client.query("select 1");

    return {
      configured: true,
      reachable: true
    };
  } catch (error) {
    logApiEvent("healthcheck_database_unreachable", context, {
      error_stage: "health",
      error_code: "database_error",
      error_message: error instanceof Error ? error.message : "Unknown database error"
    });

    return {
      configured: true,
      reachable: false,
      error: "Database is not reachable"
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function GET(request: Request): Promise<Response> {
  return withApiRoute(request, { route: "/api/health" }, async (context) => {
    const database = await checkDatabase(context.operationContext);
    const status = database.configured && !database.reachable ? 503 : 200;
    const body: HealthResponse = {
      app: "business-lead-finder",
      environment: getRuntimeConfig().appEnv,
      timestamp: new Date().toISOString(),
      database
    };

    logApiEvent("healthcheck_completed", context.operationContext, {
      status_code: status,
      error_stage: "health"
    });

    return Response.json(body, {
      status
    });
  });
}
