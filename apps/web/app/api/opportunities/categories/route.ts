import { NextResponse } from "next/server";

import {
  corsPreflight,
  logApiEvent,
  withApiRoute,
} from "@/lib/api/http";
import { requireAuth } from "@/lib/auth/session";
import { listOpportunityCategories } from "@/lib/services/opportunity-service";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  return withApiRoute(
    request,
    { route: "/api/opportunities/categories" },
    async (context) => {
      const session = await requireAuth(request, context.operationContext);
      logApiEvent("opportunity_categories_requested", context.operationContext);
      return NextResponse.json(
        await listOpportunityCategories(session.sub, context.operationContext),
      );
    },
  );
}
