import type { OperationContext } from "@/lib/api/http";
import { getRuntimeConfig } from "@/lib/config/runtime";
import { consumeRateLimitDb } from "@/lib/db/auth-rate-limits";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const entries = new Map<string, RateLimitEntry>();

export interface RateLimitOptions {
  maxAttempts: number;
  windowMs: number;
  now?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export async function consumeRateLimit(
  scope: string,
  key: string,
  context: OperationContext,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  if (process.env.NODE_ENV === "test" || getRuntimeConfig().appEnv === "test") {
    return consumeRateLimitInMemory(`${scope}:${key}`, options);
  }
  const now = options.now ?? Date.now();
  const consumed = await consumeRateLimitDb(scope, key, options.windowMs, context, now);
  const windowEnd = consumed.windowStartMs + options.windowMs;
  const allowed = consumed.count <= options.maxAttempts;
  return {
    allowed,
    remaining: allowed ? Math.max(options.maxAttempts - consumed.count, 0) : 0,
    retryAfterMs: Math.max(windowEnd - now, 0),
  };
}

function consumeRateLimitInMemory(key: string, options: RateLimitOptions): RateLimitResult {
  const now = options.now ?? Date.now();
  const current = entries.get(key);

  if (!current || now >= current.resetAt) {
    entries.set(key, { count: 1, resetAt: now + options.windowMs });
    return {
      allowed: true,
      remaining: Math.max(options.maxAttempts - 1, 0),
      retryAfterMs: options.windowMs,
    };
  }

  if (current.count >= options.maxAttempts) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: Math.max(current.resetAt - now, 0),
    };
  }

  current.count += 1;
  entries.set(key, current);
  return {
    allowed: true,
    remaining: Math.max(options.maxAttempts - current.count, 0),
    retryAfterMs: Math.max(current.resetAt - now, 0),
  };
}

export function getRateLimitIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return forwarded || realIp || "unknown";
}

export function resetRateLimitsForTests(): void {
  entries.clear();
}
