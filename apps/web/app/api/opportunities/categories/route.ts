import { NextResponse } from "next/server";

import {
  corsPreflight,
  logApiEvent,
  withApiRoute,
} from "@/lib/api/http";
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
      logApiEvent("opportunity_categories_requested", context.operationContext);
      return NextResponse.json(
        await listOpportunityCategories(context.operationContext),
      );
    },
  );
}
