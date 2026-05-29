import { NextResponse } from "next/server";

import { logApiEvent, withApiRoute } from "@/lib/api/http";
import { requireAuth } from "@/lib/auth/session";
import { listDashboardTodoAssignees } from "@/lib/services/dashboard-todo-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return withApiRoute(
    request,
    { route: "/api/dashboard/todos/assignees" },
    async (context) => {
      await requireAuth(request, context.operationContext);
      logApiEvent("dashboard_todo_assignees_requested", context.operationContext);
      const body = await listDashboardTodoAssignees(context.operationContext);
      return NextResponse.json(body, {
        headers: {
          "Cache-Control": "private, no-store, max-age=0, must-revalidate",
        },
      });
    }
  );
}
