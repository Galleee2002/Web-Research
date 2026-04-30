import { NextResponse } from "next/server";
import { parseUserRoleUpdate } from "@shared/index";

import {
  corsPreflight,
  isUuid,
  notFound,
  validationError,
  withApiRoute,
} from "@/lib/api/http";
import { requireRole } from "@/lib/auth/session";
import { updateUserRole } from "@/lib/services/auth-service";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withApiRoute(request, { route: "/api/admin/users/[id]/role" }, async (context) => {
    await requireRole(request, ["admin"], context.operationContext);
    const { id } = await params;
    if (!isUuid(id)) {
      return validationError(context.correlationId, ["id must be a valid UUID"]);
    }

    const parsed = parseUserRoleUpdate(await request.json());
    if (!parsed.ok) {
      return validationError(context.correlationId, parsed.errors);
    }

    const user = await updateUserRole(id, parsed.value.role, context.operationContext);
    if (!user) {
      return notFound(context.correlationId, "User not found");
    }

    return NextResponse.json({ user });
  });
}
