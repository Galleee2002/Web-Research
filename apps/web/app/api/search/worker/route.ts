import { NextResponse } from "next/server";

import { ApiError, corsPreflight, logApiEvent, withApiRoute } from "@/lib/api/http";
import { triggerWorkerRunInBackground } from "@/lib/services/worker-trigger";

export const runtime = "nodejs";

const WORKER_TRIGGER_MESSAGES: Record<string, string> = {
  worker_directory_not_found: "Worker directory was not found.",
  missing_database_url: "DATABASE_URL is not configured for the worker.",
  missing_google_places_api_key: "GOOGLE_PLACES_API_KEY is not configured for the worker.",
  python_runtime_not_found: "Python runtime was not found."
};

export function OPTIONS(request: Request) {
  return corsPreflight(request);
}

export async function POST(request: Request) {
  return withApiRoute(request, { route: "/api/search/worker" }, async (context) => {
    const result = triggerWorkerRunInBackground();

    logApiEvent("worker_retry_triggered", context.operationContext, {
      worker_started: result.started,
      worker_trigger_reason: result.reason ?? null
    });

    if (!result.started) {
      const message =
        (result.reason && WORKER_TRIGGER_MESSAGES[result.reason]) ||
        "Worker could not be started.";
      throw new ApiError("internal_error", message, 503);
    }

    return NextResponse.json(result);
  });
}
