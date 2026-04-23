import { NextResponse } from "next/server";
import { parseBusinessFilters } from "@shared/index";

import {
  logApiEvent,
  searchParamsToObject,
  validationError,
  withApiRoute
} from "@/lib/api/http";
import { listBusinesses } from "@/lib/services/business-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return withApiRoute(request, { route: "/api/businesses" }, async (context) => {
    const url = new URL(request.url);
    const parsed = parseBusinessFilters(searchParamsToObject(url.searchParams));

    if (!parsed.ok) {
      return validationError(context.correlationId, parsed.errors);
    }

    logApiEvent("business_list_requested", context.operationContext);
    return NextResponse.json(await listBusinesses(parsed.value, context.operationContext));
  });
}
