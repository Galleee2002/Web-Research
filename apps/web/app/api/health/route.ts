import { Client } from "pg";

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

async function checkDatabase(): Promise<DatabaseHealth> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    return {
      configured: false,
      reachable: null
    };
  }

  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 1500
  });

  try {
    await client.connect();
    await client.query("select 1");

    return {
      configured: true,
      reachable: true
    };
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      error: error instanceof Error ? error.message : "Unknown database error"
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function GET(): Promise<Response> {
  const database = await checkDatabase();
  const body: HealthResponse = {
    app: "business-lead-finder",
    environment: process.env.APP_ENV ?? "development",
    timestamp: new Date().toISOString(),
    database
  };

  return Response.json(body, {
    status: database.configured && !database.reachable ? 503 : 200
  });
}
