import { describe, expect, it } from "vitest";

import { getRuntimeConfig } from "./runtime";

describe("runtime config", () => {
  it("uses safe development defaults", () => {
    const config = getRuntimeConfig({});

    expect(config.appEnv).toBe("development");
    expect(config.logLevel).toBe("info");
    expect(config.allowedOrigins).toEqual([]);
    expect(config.apiJsonBodyLimitBytes).toBe(1_000_000);
    expect(config.dbPoolMax).toBe(10);
    expect(config.dbIdleTimeoutMs).toBe(10_000);
    expect(config.dbConnectionTimeoutMs).toBe(10_000);
    expect(config.dbQueryTimeoutMs).toBe(10_000);
    expect(config.dbSsl).toBe(false);
  });

  it("parses explicit allowed origins and database pool settings", () => {
    const config = getRuntimeConfig({
      APP_ENV: "production",
      DATABASE_URL: "postgres://user:pass@example.com:5432/app",
      GOOGLE_PLACES_API_KEY: "places-key",
      LOG_LEVEL: "warn",
      ALLOWED_ORIGINS: "https://app.example.com, https://admin.example.com ",
      API_JSON_BODY_LIMIT_BYTES: "2048",
      DB_POOL_MAX: "5",
      DB_IDLE_TIMEOUT_MS: "30000",
      DB_CONNECTION_TIMEOUT_MS: "2000",
      DB_QUERY_TIMEOUT_MS: "5000",
      DB_SSL: "require"
    });

    expect(config.allowedOrigins).toEqual([
      "https://app.example.com",
      "https://admin.example.com"
    ]);
    expect(config.apiJsonBodyLimitBytes).toBe(2048);
    expect(config.dbPoolMax).toBe(5);
    expect(config.dbIdleTimeoutMs).toBe(30000);
    expect(config.dbConnectionTimeoutMs).toBe(2000);
    expect(config.dbQueryTimeoutMs).toBe(5000);
    expect(config.dbSsl).toBe(true);
  });

  it("fails fast for missing production secrets", () => {
    expect(() =>
      getRuntimeConfig({
        APP_ENV: "production",
        DATABASE_URL: "postgres://user:pass@example.com:5432/app"
      })
    ).toThrow("GOOGLE_PLACES_API_KEY is required in production");
  });

  it("rejects invalid numeric and enum configuration", () => {
    expect(() => getRuntimeConfig({ LOG_LEVEL: "verbose" })).toThrow("LOG_LEVEL");
    expect(() => getRuntimeConfig({ API_JSON_BODY_LIMIT_BYTES: "0" })).toThrow(
      "API_JSON_BODY_LIMIT_BYTES"
    );
    expect(() => getRuntimeConfig({ ALLOWED_ORIGINS: "not a url" })).toThrow(
      "ALLOWED_ORIGINS"
    );
  });
});
