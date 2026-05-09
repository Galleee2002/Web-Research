import { NextResponse } from "next/server";

import { logApiEvent, withApiRoute } from "@/lib/api/http";
import { removeCompletedDashboardTodos } from "@/lib/services/dashboard-todo-service";

export const runtime = "nodejs";

export async function DELETE(_request: Request) {
  return withApiRoute(_request, { route: "/api/dashboard/todos/completed" }, async (context) => {
    const result = await removeCompletedDashboardTodos(context.operationContext);
    logApiEvent("dashboard_todos_completed_deleted", context.operationContext, {
      deleted: result.deleted,
    });
    return NextResponse.json(result);
  });
}
