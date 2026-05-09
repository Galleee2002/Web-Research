import { NextResponse } from "next/server";
import { parseDashboardTodoCreate } from "@shared/index";

import {
  invalidJsonError,
  logApiEvent,
  notFound,
  validationError,
  withApiRoute,
} from "@/lib/api/http";
import {
  createDashboardTodo,
  listDashboardTodos,
} from "@/lib/services/dashboard-todo-service";

export const runtime = "nodejs";

export async function GET(_request: Request) {
  return withApiRoute(_request, { route: "/api/dashboard/todos" }, async (context) => {
    logApiEvent("dashboard_todo_list_requested", context.operationContext);
    return NextResponse.json(await listDashboardTodos(context.operationContext));
  });
}

export async function POST(request: Request) {
  return withApiRoute(request, { route: "/api/dashboard/todos" }, async (context) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return invalidJsonError(context.correlationId);
    }

    const parsed = parseDashboardTodoCreate(body);
    if (!parsed.ok) {
      return validationError(context.correlationId, parsed.errors);
    }

    const created = await createDashboardTodo(parsed.value, context.operationContext);
    if (!created) {
      return notFound(context.correlationId, "Business not found");
    }

    logApiEvent("dashboard_todo_created", context.operationContext);
    return NextResponse.json(created, { status: 201 });
  });
}
