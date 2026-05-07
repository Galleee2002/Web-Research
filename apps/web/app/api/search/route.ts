import { NextResponse } from "next/server";
import { parseSearchCreate } from "@shared/index";

import {
  corsPreflight,
  logApiEvent,
  validationError,
  withApiRoute
} from "@/lib/api/http";
import { requireAuth } from "@/lib/auth/session";
import { createSearchRun } from "@/lib/services/search-service";
import { triggerWorkerRunInBackground } from "@/lib/services/worker-trigger";

export const runtime = "nodejs";

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function POST(request: Request) {
  return withApiRoute(request, { route: "/api/search" }, async (context) => {
    const payload = await request.json();
    const parsed = parseSearchCreate(payload);

    if (!parsed.ok) {
      return validationError(context.correlationId, parsed.errors);
    }

    const session = await requireAuth(request, context.operationContext);
    const searchRun = await createSearchRun(parsed.value, session.sub, context.operationContext);
    const workerTrigger = triggerWorkerRunInBackground();
    logApiEvent("search_run_created", context.operationContext, {
      search_run_id: searchRun.id,
      provider: searchRun.source,
      worker_triggered: workerTrigger.started,
      worker_trigger_reason: workerTrigger.reason ?? null
    });

    return NextResponse.json(searchRun, { status: 201 });
  });
}
