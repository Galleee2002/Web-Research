import { NextResponse } from "next/server";
import { parseScanFilters } from "@shared/index";

import {
  corsPreflight,
  logApiEvent,
  searchParamsToObject,
  validationError,
  withApiRoute,
} from "@/lib/api/http";
import { listProviderCalls } from "@/lib/services/scans";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function GET(request: Request) {
  return withApiRoute(
    request,
    { route: "/api/scans" },
    async (context) => {
      const url = new URL(request.url);
      const parsed = parseScanFilters(searchParamsToObject(url.searchParams));

      if (!parsed.ok) {
        return validationError(context.correlationId, parsed.errors);
      }

      logApiEvent("scans_list_requested", context.operationContext);
      return NextResponse.json(
        await listProviderCalls(parsed.value, context.operationContext)
      );
    }
  );
}
