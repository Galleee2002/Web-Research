import { NextResponse } from "next/server";
import { parseBusinessCreate, parseBusinessFilters } from "@shared/index";

import {
  corsPreflight,
  invalidJsonError,
  logApiEvent,
  searchParamsToObject,
  validationError,
  withApiRoute
} from "@/lib/api/http";
import { createManualBusiness, listBusinesses } from "@/lib/services/business-service";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

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

export async function POST(request: Request) {
  return withApiRoute(request, { route: "/api/businesses" }, async (context) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalidJsonError(context.correlationId);
    }

    const parsed = parseBusinessCreate(body);
    if (!parsed.ok) {
      return validationError(context.correlationId, parsed.errors);
    }

    const created = await createManualBusiness(parsed.value, context.operationContext);

    logApiEvent("business_created", context.operationContext, {
      business_id: created.id,
      source: created.source,
      has_website: created.has_website
    });

    return NextResponse.json(created, { status: 201 });
  });
}
