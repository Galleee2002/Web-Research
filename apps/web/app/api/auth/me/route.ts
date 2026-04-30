import { NextResponse } from "next/server";
import { parseAuthProfileUpdate } from "@shared/index";

import { corsPreflight, notFound, validationError, withApiRoute } from "@/lib/api/http";
import { requireAuth } from "@/lib/auth/session";
import { getUserById, updateCurrentUserProfile } from "@/lib/services/auth-service";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  return withApiRoute(request, { route: "/api/auth/me" }, async (context) => {
    const session = await requireAuth(request, context.operationContext);
    const user = await getUserById(session.sub, context.operationContext);
    if (!user) {
      return notFound(context.correlationId, "User not found");
    }

    return NextResponse.json({ user });
  });
}

export async function PATCH(request: Request) {
  return withApiRoute(request, { route: "/api/auth/me" }, async (context) => {
    const session = await requireAuth(request, context.operationContext);
    const parsed = parseAuthProfileUpdate(await request.json());
    if (!parsed.ok) {
      return validationError(context.correlationId, parsed.errors);
    }

    const user = await updateCurrentUserProfile(
      session.sub,
      parsed.value,
      context.operationContext,
    );
    if (!user) {
      return notFound(context.correlationId, "User not found");
    }

    return NextResponse.json({ user });
  });
}
