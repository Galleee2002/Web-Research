import { NextResponse } from "next/server";

import { corsPreflight, logApiEvent, withApiRoute } from "@/lib/api/http";
import { clearCsrfCookie, clearSessionCookie, requireAuth } from "@/lib/auth/session";
import { revokeUserSessions } from "@/lib/services/auth-service";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function POST(request: Request) {
  return withApiRoute(request, { route: "/api/auth/logout" }, async (context) => {
    const session = await requireAuth(request, context.operationContext);
    await revokeUserSessions(session.sub, context.operationContext);
    logApiEvent("auth_session_revoked", context.operationContext, {
      user_id: session.sub,
    });
    const response = NextResponse.json({ ok: true });
    clearSessionCookie(response);
    clearCsrfCookie(response);
    logApiEvent("auth_logout_succeeded", context.operationContext, {
      user_id: session.sub,
    });
    return response;
  });
}
