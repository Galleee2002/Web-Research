import { NextResponse } from "next/server";

import {
  corsPreflight,
  isUuid,
  logApiEvent,
  validationError,
  withApiRoute
} from "@/lib/api/http";
import { createNextSearchRun } from "@/lib/services/search-service";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: Request, context: RouteContext) {
  return withApiRoute(request, { route: "/api/search/[id]/next" }, async (requestContext) => {
    const { id } = await context.params;

    if (!isUuid(id)) {
      return validationError(requestContext.correlationId, ["id must be a valid UUID"]);
    }

    const result = await createNextSearchRun(id, requestContext.operationContext);

    logApiEvent("search_run_next_page_requested", requestContext.operationContext, {
      search_run_id: result.searchRun.id,
      provider: result.searchRun.source,
      parent_search_run_id: id,
      page_number: result.searchRun.page_number,
      is_idempotent: !result.created
    });

    return NextResponse.json(result.searchRun, { status: result.created ? 201 : 200 });
  });
}
