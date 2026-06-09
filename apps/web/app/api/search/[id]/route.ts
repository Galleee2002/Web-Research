import { NextResponse } from "next/server";

import {
  corsPreflight,
  isUuid,
  logApiEvent,
  validationError,
  withApiRoute
} from "@/lib/api/http";
import { cancelPendingSearchRun } from "@/lib/services/cancel-pending-search-run";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function DELETE(request: Request, context: RouteContext) {
  return withApiRoute(request, { route: "/api/search/[id]" }, async (requestContext) => {
    const { id } = await context.params;

    if (!isUuid(id)) {
      return validationError(requestContext.correlationId, ["id must be a valid UUID"]);
    }

    const result = await cancelPendingSearchRun(id, requestContext.operationContext);

    logApiEvent("search_run_cancelled", requestContext.operationContext, {
      search_run_id: result.id
    });

    return NextResponse.json(result);
  });
}
