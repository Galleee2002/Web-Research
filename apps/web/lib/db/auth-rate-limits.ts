import { createHash } from "node:crypto";

import type { OperationContext } from "@/lib/api/http";

import { query } from "./pool";

export interface RateLimitConsumeResult {
  count: number;
  windowStartMs: number;
}

interface ConsumeRateLimitRow {
  count: number;
  window_start_ms: string;
}

export function hashRateLimitKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function computeWindowStartMs(nowMs: number, windowMs: number): number {
  return Math.floor(nowMs / windowMs) * windowMs;
}

export async function consumeRateLimitDb(
  scope: string,
  key: string,
  windowMs: number,
  context: OperationContext,
  nowMs = Date.now(),
): Promise<RateLimitConsumeResult> {
  const windowStartMs = computeWindowStartMs(nowMs, windowMs);
  const keyHash = hashRateLimitKey(key);
  const result = await query<ConsumeRateLimitRow>(
    `
      insert into auth_rate_limits (scope, key_hash, window_start, count, updated_at)
      values ($1, $2, to_timestamp($3 / 1000.0), 1, now())
      on conflict (scope, key_hash, window_start)
      do update set
        count = auth_rate_limits.count + 1,
        updated_at = now()
      returning count, extract(epoch from window_start) * 1000 as window_start_ms
    `,
    [scope, keyHash, windowStartMs],
    { operationName: "consume_auth_rate_limit", context },
  );

  return {
    count: result.rows[0].count,
    windowStartMs: Number(result.rows[0].window_start_ms),
  };
}

export async function cleanupExpiredRateLimits(
  olderThanMs: number,
  context: OperationContext,
): Promise<number> {
  const result = await query<{ deleted_count: string }>(
    `
      with deleted as (
        delete from auth_rate_limits
        where updated_at < to_timestamp($1 / 1000.0)
        returning 1
      )
      select count(*)::text as deleted_count from deleted
    `,
    [olderThanMs],
    { operationName: "cleanup_auth_rate_limits", context },
  );
  return Number(result.rows[0]?.deleted_count ?? "0");
}
