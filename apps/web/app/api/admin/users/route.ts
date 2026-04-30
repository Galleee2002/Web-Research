import { NextResponse } from "next/server";

import { corsPreflight, withApiRoute } from "@/lib/api/http";
import { requireRole } from "@/lib/auth/session";
import { listUsers } from "@/lib/services/auth-service";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  return withApiRoute(request, { route: "/api/admin/users" }, async (context) => {
    await requireRole(request, ["admin"], context.operationContext);
    return NextResponse.json({ items: await listUsers(context.operationContext) });
  });
}
