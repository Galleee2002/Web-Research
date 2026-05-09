import { NextResponse } from "next/server";
import { parseDashboardTodoUpdate } from "@shared/index";

import {
  invalidJsonError,
  logApiEvent,
  notFound,
  isUuid,
  validationError,
  withApiRoute,
} from "@/lib/api/http";
import { updateDashboardTodo } from "@/lib/services/dashboard-todo-service";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function PATCH(request: Request, routeContext: RouteContext) {
  return withApiRoute(request, { route: "/api/dashboard/todos/[id]" }, async (context) => {
    const { id } = await routeContext.params;

    if (!isUuid(id)) {
      return validationError(context.correlationId, ["id must be a valid UUID"]);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalidJsonError(context.correlationId);
    }

    const parsed = parseDashboardTodoUpdate(body);
    if (!parsed.ok) {
      return validationError(context.correlationId, parsed.errors);
    }

    const updated = await updateDashboardTodo(id, parsed.value, context.operationContext);
    if (!updated) {
      return notFound(context.correlationId, "Task not found");
    }

    logApiEvent("dashboard_todo_updated", context.operationContext);
    return NextResponse.json(updated);
  });
}
