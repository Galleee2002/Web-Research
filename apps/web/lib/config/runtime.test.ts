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
    expect(config.authCookieName).toBe("blf_session");
    expect(config.authCsrfCookieName).toBe("blf_csrf");
    expect(config.authSessionTtlSeconds).toBe(60 * 60 * 8);
    expect(config.authPasswordScryptKeyLength).toBe(64);
  });

  it("parses explicit allowed origins and database pool settings", () => {
    const config = getRuntimeConfig({
      APP_ENV: "production",
      DATABASE_URL: "postgres://user:pass@example.com:5432/app?sslmode=verify-full",
      GOOGLE_PLACES_API_KEY: "places-key",
      LOG_LEVEL: "warn",
      ALLOWED_ORIGINS: "https://app.example.com, https://admin.example.com ",
      API_JSON_BODY_LIMIT_BYTES: "2048",
      DB_POOL_MAX: "5",
      DB_IDLE_TIMEOUT_MS: "30000",
      DB_CONNECTION_TIMEOUT_MS: "2000",
      DB_QUERY_TIMEOUT_MS: "5000",
      DB_SSL: "require",
      AUTH_JWT_SECRET: "production-secret-at-least-32-characters",
      AUTH_COOKIE_NAME: "custom_session",
      AUTH_CSRF_COOKIE_NAME: "custom_csrf",
      AUTH_SESSION_TTL_SECONDS: "3600",
      AUTH_PASSWORD_SCRYPT_KEY_LENGTH: "32"
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
    expect(config.authJwtSecret).toBe("production-secret-at-least-32-characters");
    expect(config.authCookieName).toBe("custom_session");
    expect(config.authCsrfCookieName).toBe("custom_csrf");
    expect(config.authSessionTtlSeconds).toBe(3600);
    expect(config.authPasswordScryptKeyLength).toBe(32);
  });

  it("fails fast for missing production secrets", () => {
    expect(() =>
      getRuntimeConfig({
        APP_ENV: "production",
        DATABASE_URL: "postgres://user:pass@example.com:5432/app?sslmode=verify-full",
        GOOGLE_PLACES_API_KEY: "places-key",
        ALLOWED_ORIGINS: "https://app.example.com"
      })
    ).toThrow("AUTH_JWT_SECRET is required in production");
  });

  it("requires strict sslmode and allowed origins in production", () => {
    expect(() =>
      getRuntimeConfig({
        APP_ENV: "production",
        DATABASE_URL: "postgres://user:pass@example.com:5432/app",
        GOOGLE_PLACES_API_KEY: "places-key",
        AUTH_JWT_SECRET: "production-secret-at-least-32-characters",
        ALLOWED_ORIGINS: "https://app.example.com"
      })
    ).toThrow("sslmode=verify-full");

    expect(() =>
      getRuntimeConfig({
        APP_ENV: "production",
        DATABASE_URL: "postgres://user:pass@example.com:5432/app?sslmode=verify-full",
        GOOGLE_PLACES_API_KEY: "places-key",
        AUTH_JWT_SECRET: "production-secret-at-least-32-characters",
      })
    ).toThrow("ALLOWED_ORIGINS is required in production");
  });

  it("rejects invalid numeric and enum configuration", () => {
    expect(() => getRuntimeConfig({ LOG_LEVEL: "verbose" })).toThrow("LOG_LEVEL");
    expect(() => getRuntimeConfig({ API_JSON_BODY_LIMIT_BYTES: "0" })).toThrow(
      "API_JSON_BODY_LIMIT_BYTES"
    );
    expect(() => getRuntimeConfig({ ALLOWED_ORIGINS: "not a url" })).toThrow(
      "ALLOWED_ORIGINS"
    );
    expect(() => getRuntimeConfig({ AUTH_SESSION_TTL_SECONDS: "0" })).toThrow(
      "AUTH_SESSION_TTL_SECONDS"
    );
    expect(() => getRuntimeConfig({ AUTH_COOKIE_NAME: "bad cookie" })).toThrow(
      "AUTH_COOKIE_NAME"
    );
  });
});
