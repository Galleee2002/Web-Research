import { NextResponse } from "next/server";
import { parseBusinessFilters } from "@shared/index";

import {
  corsPreflight,
  logApiEvent,
  searchParamsToObject,
  validationError,
  withApiRoute
} from "@/lib/api/http";
import { listBusinesses } from "@/lib/services/business-service";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  return withApiRoute(request, { route: "/api/opportunities" }, async (context) => {
    const url = new URL(request.url);
    const parsed = parseBusinessFilters({
      ...searchParamsToObject(url.searchParams),
      status: "opportunities"
    });

    if (!parsed.ok) {
      return validationError(context.correlationId, parsed.errors);
    }

    logApiEvent("opportunity_list_requested", context.operationContext);
    return NextResponse.json(await listBusinesses(parsed.value, context.operationContext));
  });
}
