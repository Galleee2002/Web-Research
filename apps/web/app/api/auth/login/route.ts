import { NextResponse } from "next/server";
import { parseAuthLogin } from "@shared/index";

import { ApiError, corsPreflight, logApiEvent, validationError, withApiRoute } from "@/lib/api/http";
import { consumeRateLimit, getRateLimitIp } from "@/lib/auth/rate-limit";
import { createCsrfToken, setCsrfCookie, setSessionCookie } from "@/lib/auth/session";
import { authenticateUser } from "@/lib/services/auth-service";

export const runtime = "nodejs";
const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5;

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function POST(request: Request) {
  return withApiRoute(request, { route: "/api/auth/login" }, async (context) => {
    const parsed = parseAuthLogin(await request.json());
    if (!parsed.ok) {
      return validationError(context.correlationId, parsed.errors);
    }

    const ip = getRateLimitIp(request);
    const identity = parsed.value.emailOrUsername.toLowerCase();
    const identityRateLimit = await consumeRateLimit(
      "auth:login:identity",
      identity,
      context.operationContext,
      {
      maxAttempts: LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
      windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
      },
    );
    const ipRateLimit = await consumeRateLimit("auth:login:ip", ip, context.operationContext, {
      maxAttempts: LOGIN_RATE_LIMIT_MAX_ATTEMPTS * 3,
      windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
    });
    if (!identityRateLimit.allowed || !ipRateLimit.allowed) {
      logApiEvent("auth_login_failed", context.operationContext, {
        reason: "rate_limited",
        ip,
        identity,
      });
      throw new ApiError("too_many_requests", "Too many login attempts. Try again later.", 429);
    }

    let result;
    try {
      result = await authenticateUser(parsed.value, context.operationContext);
    } catch (error) {
      if (error instanceof ApiError && error.code === "unauthorized") {
        logApiEvent("auth_login_failed", context.operationContext, {
          reason: "invalid_credentials",
          ip,
          identity,
        });
      }
      throw error;
    }
    const response = NextResponse.json({ user: result.user });
    setSessionCookie(response, result.token);
    setCsrfCookie(response, createCsrfToken());
    logApiEvent("auth_login_succeeded", context.operationContext, {
      user_id: result.user.id,
      ip,
      identity,
    });
    return response;
  });
}
