import type { DashboardTodoItem } from "@/lib/dashboard/todo-types";

/**
 * Replace with real HTTP calls when dashboard todo endpoints exist.
 * Swallowed errors keep the UI responsive under mock/local failures.
 */
export async function syncTodoCompleted(
  _todoId: string,
  _completed: boolean
): Promise<void> {
  await Promise.resolve();
}

export async function syncTodoCreated(_todo: DashboardTodoItem): Promise<void> {
  await Promise.resolve();
}
