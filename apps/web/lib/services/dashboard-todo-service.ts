import type {
  DashboardTodoCompletedUpdate,
  DashboardTodoCreate,
  DashboardTodoRead,
  DashboardTodosDeletedResponse,
  DashboardTodosListResponse,
} from "@shared/index";

import type { OperationContext } from "@/lib/api/http";

import {
  deleteCompletedDashboardTodos as defaultDeleteCompletedDashboardTodos,
  findDashboardTodos as defaultFindDashboardTodos,
  insertDashboardTodo as defaultInsertDashboardTodo,
  updateDashboardTodoCompleted as defaultUpdateDashboardTodoCompleted,
} from "@/lib/db/dashboard-todos";

interface DashboardTodoServiceDependencies {
  findDashboardTodos: typeof defaultFindDashboardTodos;
  insertDashboardTodo: typeof defaultInsertDashboardTodo;
  updateDashboardTodoCompleted: typeof defaultUpdateDashboardTodoCompleted;
  deleteCompletedDashboardTodos: typeof defaultDeleteCompletedDashboardTodos;
}

const defaultDeps = {
  findDashboardTodos: defaultFindDashboardTodos,
  insertDashboardTodo: defaultInsertDashboardTodo,
  updateDashboardTodoCompleted: defaultUpdateDashboardTodoCompleted,
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

export async function setDashboardTodoCompleted(
  id: string,
  payload: DashboardTodoCompletedUpdate,
  context: OperationContext,
  deps: DashboardTodoServiceDependencies = defaultDeps
): Promise<DashboardTodoRead | null> {
  return deps.updateDashboardTodoCompleted(id, payload.completed, context);
}

export async function removeCompletedDashboardTodos(
  context: OperationContext,
  deps: DashboardTodoServiceDependencies = defaultDeps
): Promise<DashboardTodosDeletedResponse> {
  const deleted = await deps.deleteCompletedDashboardTodos(context);
  return { deleted };
}
