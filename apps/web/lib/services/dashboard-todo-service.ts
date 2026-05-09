import type {
  DashboardTodoCreate,
  DashboardTodoRead,
  DashboardTodoUpdate,
  DashboardTodosDeletedResponse,
  DashboardTodosListResponse,
} from "@shared/index";

import type { OperationContext } from "@/lib/api/http";

import {
  deleteCompletedDashboardTodos as defaultDeleteCompletedDashboardTodos,
  findDashboardTodos as defaultFindDashboardTodos,
  insertDashboardTodo as defaultInsertDashboardTodo,
  updateDashboardTodo as defaultUpdateDashboardTodo,
} from "@/lib/db/dashboard-todos";

interface DashboardTodoServiceDependencies {
  findDashboardTodos: typeof defaultFindDashboardTodos;
  insertDashboardTodo: typeof defaultInsertDashboardTodo;
  updateDashboardTodo: typeof defaultUpdateDashboardTodo;
  deleteCompletedDashboardTodos: typeof defaultDeleteCompletedDashboardTodos;
}

const defaultDeps = {
  findDashboardTodos: defaultFindDashboardTodos,
  insertDashboardTodo: defaultInsertDashboardTodo,
  updateDashboardTodo: defaultUpdateDashboardTodo,
  deleteCompletedDashboardTodos: defaultDeleteCompletedDashboardTodos,
} satisfies DashboardTodoServiceDependencies;

export async function listDashboardTodos(
  context: OperationContext,
  deps: DashboardTodoServiceDependencies = defaultDeps
): Promise<DashboardTodosListResponse> {
  return deps.findDashboardTodos(context);
}

export async function createDashboardTodo(
  input: DashboardTodoCreate,
  context: OperationContext,
  deps: DashboardTodoServiceDependencies = defaultDeps
): Promise<DashboardTodoRead | null> {
  return deps.insertDashboardTodo(input, context);
}

export async function updateDashboardTodo(
  id: string,
  payload: DashboardTodoUpdate,
  context: OperationContext,
  deps: DashboardTodoServiceDependencies = defaultDeps
): Promise<DashboardTodoRead | null> {
  return deps.updateDashboardTodo(id, payload, context);
}

export async function removeCompletedDashboardTodos(
  context: OperationContext,
  deps: DashboardTodoServiceDependencies = defaultDeps
): Promise<DashboardTodosDeletedResponse> {
  const deleted = await deps.deleteCompletedDashboardTodos(context);
  return { deleted };
}
