import { NextResponse } from "next/server";
import { parseSearchFilters } from "@shared/index";

import {
  corsPreflight,
  logApiEvent,
  searchParamsToObject,
  validationError,
  withApiRoute
} from "@/lib/api/http";
import { listSearchRuns } from "@/lib/services/search-service";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  return withApiRoute(request, { route: "/api/searches" }, async (context) => {
    const url = new URL(request.url);
    const parsed = parseSearchFilters(searchParamsToObject(url.searchParams));

    if (!parsed.ok) {
      return validationError(context.correlationId, parsed.errors);
    }

    logApiEvent("search_runs_requested", context.operationContext);
    return NextResponse.json(await listSearchRuns(parsed.value, context.operationContext));
  });
}
