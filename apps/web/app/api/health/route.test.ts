import { describe, expect, it } from "vitest";

import { GET } from "./route";

describe("GET /api/health", () => {
  it("returns app status without requiring a database URL", async () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    const previousAppEnv = process.env.APP_ENV;
    delete process.env.DATABASE_URL;
    delete process.env.APP_ENV;

    try {
      const response = await GET(new Request("http://localhost/api/health"));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        app: "business-lead-finder",
        environment: "development",
        database: {
          configured: false,
          reachable: null
        }
      });
      expect(body.timestamp).toEqual(expect.any(String));
    } finally {
      if (previousDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = previousDatabaseUrl;
      }

      if (previousAppEnv === undefined) {
        delete process.env.APP_ENV;
      } else {
        process.env.APP_ENV = previousAppEnv;
      }
    }
  });

  it("reports an unhealthy response when configured database is unreachable", async () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgres://invalid:invalid@127.0.0.1:1/invalid";

    try {
      const response = await GET(new Request("http://localhost/api/health"));
      const body = await response.json();

      expect(response.status).toBe(503);
      expect(body.database).toMatchObject({
        configured: true,
        reachable: false
      });
      expect(body.database.error).toBe("Database is not reachable");
    } finally {
      if (previousDatabaseUrl === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = previousDatabaseUrl;
      }
    }
  });
});
