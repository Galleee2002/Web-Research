import { patchDashboardTodoCompleted } from "@/lib/api/dashboard-todos-client";

export async function syncTodoCompleted(todoId: string, completed: boolean): Promise<void> {
  await patchDashboardTodoCompleted(todoId, completed);
}
