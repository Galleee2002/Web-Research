import { NextResponse } from "next/server";
import { parseAuthRegistration } from "@shared/index";

import { ApiError, corsPreflight, logApiEvent, validationError, withApiRoute } from "@/lib/api/http";
import { consumeRateLimit, getRateLimitIp } from "@/lib/auth/rate-limit";
import { registerUser } from "@/lib/services/auth-service";

export const runtime = "nodejs";
const REGISTER_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const REGISTER_RATE_LIMIT_MAX_ATTEMPTS = 5;

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function POST(request: Request) {
  return withApiRoute(request, { route: "/api/auth/register" }, async (context) => {
    const parsed = parseAuthRegistration(await request.json());
    if (!parsed.ok) {
      return validationError(context.correlationId, parsed.errors);
    }

    const ip = getRateLimitIp(request);
    const email = parsed.value.email.toLowerCase();
    const emailRateLimit = await consumeRateLimit(
      "auth:register:email",
      email,
      context.operationContext,
      {
      maxAttempts: REGISTER_RATE_LIMIT_MAX_ATTEMPTS,
      windowMs: REGISTER_RATE_LIMIT_WINDOW_MS,
      },
    );
    const ipRateLimit = await consumeRateLimit("auth:register:ip", ip, context.operationContext, {
      maxAttempts: REGISTER_RATE_LIMIT_MAX_ATTEMPTS * 2,
      windowMs: REGISTER_RATE_LIMIT_WINDOW_MS,
    });
    if (!emailRateLimit.allowed || !ipRateLimit.allowed) {
      logApiEvent("auth_register_blocked_rate_limit", context.operationContext, {
        reason: "rate_limited",
        ip,
        email,
      });
      throw new ApiError(
        "too_many_requests",
        "Too many registration attempts. Try again later.",
        429,
      );
    }

    const user = await registerUser(parsed.value, context.operationContext);
    logApiEvent("auth_register_succeeded", context.operationContext, {
      user_id: user.id,
      ip,
      email,
    });
    return NextResponse.json({ user }, { status: 201 });
  });
}
