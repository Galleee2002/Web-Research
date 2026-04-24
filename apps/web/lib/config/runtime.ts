type AppEnv = "development" | "production" | "test";
type LogLevel = "debug" | "error" | "info" | "warn";

export interface RuntimeConfig {
  appEnv: AppEnv;
  databaseUrl?: string;
  googlePlacesApiKey?: string;
  logLevel: LogLevel;
  allowedOrigins: string[];
  apiJsonBodyLimitBytes: number;
  dbPoolMax: number;
  dbIdleTimeoutMs: number;
  dbConnectionTimeoutMs: number;
  dbQueryTimeoutMs: number;
  dbSsl: boolean;
}

type Env = Record<string, string | undefined>;

const APP_ENVS = new Set(["development", "production", "test"]);
const LOG_LEVELS = new Set(["debug", "error", "info", "warn"]);

export function getRuntimeConfig(env: Env = process.env): RuntimeConfig {
  const appEnv = parseEnum<AppEnv>(env.APP_ENV, "APP_ENV", APP_ENVS, "development");
  const logLevel = parseEnum<LogLevel>(env.LOG_LEVEL, "LOG_LEVEL", LOG_LEVELS, "info");
  const databaseUrl = emptyToUndefined(env.DATABASE_URL);
  const googlePlacesApiKey = emptyToUndefined(env.GOOGLE_PLACES_API_KEY);

  if (appEnv === "production") {
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required in production");
    }
    if (!googlePlacesApiKey) {
      throw new Error("GOOGLE_PLACES_API_KEY is required in production");
    }
  }

  return {
    appEnv,
    databaseUrl,
    googlePlacesApiKey,
    logLevel,
    allowedOrigins: parseAllowedOrigins(env.ALLOWED_ORIGINS),
    apiJsonBodyLimitBytes: parsePositiveInteger(
      env.API_JSON_BODY_LIMIT_BYTES,
      "API_JSON_BODY_LIMIT_BYTES",
      1_000_000
    ),
    dbPoolMax: parsePositiveInteger(env.DB_POOL_MAX, "DB_POOL_MAX", 10),
    dbIdleTimeoutMs: parsePositiveInteger(
      env.DB_IDLE_TIMEOUT_MS,
      "DB_IDLE_TIMEOUT_MS",
      10_000
    ),
    dbConnectionTimeoutMs: parsePositiveInteger(
      env.DB_CONNECTION_TIMEOUT_MS,
      "DB_CONNECTION_TIMEOUT_MS",
      1_500
    ),
    dbQueryTimeoutMs: parsePositiveInteger(
      env.DB_QUERY_TIMEOUT_MS,
      "DB_QUERY_TIMEOUT_MS",
      10_000
    ),
    dbSsl: parseDbSsl(env.DB_SSL)
  };
}

function emptyToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseEnum<T extends string>(
  value: string | undefined,
  name: string,
  allowed: Set<string>,
  fallback: T
): T {
  const normalized = emptyToUndefined(value) ?? fallback;
  if (!allowed.has(normalized)) {
    throw new Error(`${name} must be one of ${Array.from(allowed).join(", ")}`);
  }
  return normalized as T;
}

function parsePositiveInteger(
  value: string | undefined,
  name: string,
  fallback: number
): number {
  const normalized = emptyToUndefined(value);
  if (normalized === undefined) {
    return fallback;
  }

  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

function parseDbSsl(value: string | undefined): boolean {
  const normalized = emptyToUndefined(value)?.toLowerCase();
  if (normalized === undefined || normalized === "disable" || normalized === "false") {
    return false;
  }
  if (normalized === "require" || normalized === "true") {
    return true;
  }
  throw new Error("DB_SSL must be disable, false, require, or true");
}

function parseAllowedOrigins(value: string | undefined): string[] {
  const normalized = emptyToUndefined(value);
  if (normalized === undefined) {
    return [];
  }

  return normalized.split(",").map((entry) => {
    const origin = entry.trim();
    try {
      const parsed = new URL(origin);
      if (parsed.origin !== origin || !["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("invalid origin");
      }
      return origin;
    } catch {
      throw new Error("ALLOWED_ORIGINS must contain comma-separated URL origins");
    }
  });
}
