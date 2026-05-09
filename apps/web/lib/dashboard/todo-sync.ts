import type { DashboardTodoUpdate } from "@shared/index";

import { patchDashboardTodo } from "@/lib/api/dashboard-todos-client";
import type { DashboardTodoItem } from "@/lib/dashboard/todo-types";

export async function syncDashboardTodo(
  todoId: string,
  patch: DashboardTodoUpdate
): Promise<DashboardTodoItem> {
  return patchDashboardTodo(todoId, patch);
}
