import type {
  DashboardTodoCreate,
  DashboardTodoRead,
  DashboardTodosListResponse,
} from "@shared/index";

import type { OperationContext } from "@/lib/api/http";

import { query } from "./pool";
import { toIsoString } from "./shared-query";

interface DashboardTodoRow {
  id: string;
  title: string;
  business_id: string;
  business_name: string;
  business_status: DashboardTodoRead["business_status"];
  completed: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

const SELECT_FIELDS = `
  dashboard_todos.id,
  dashboard_todos.title,
  dashboard_todos.business_id,
  businesses.name as business_name,
  businesses.status as business_status,
  dashboard_todos.completed,
  dashboard_todos.created_at,
  dashboard_todos.updated_at
`;

/** Aliases for UPDATE ... FROM ... RETURNING (dt = dashboard_todos, b = businesses). */
const UPDATE_RETURNING_FIELDS = `
  dt.id,
  dt.title,
  dt.business_id,
  b.name as business_name,
  b.status as business_status,
  dt.completed,
  dt.created_at,
  dt.updated_at
`;

function mapRow(row: DashboardTodoRow): DashboardTodoRead {
  return {
    id: row.id,
    title: row.title,
    business_id: row.business_id,
    business_name: row.business_name,
    business_status: row.business_status,
    completed: row.completed,
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
  };
}

export async function findDashboardTodos(
  context: OperationContext
): Promise<DashboardTodosListResponse> {
  const result = await query<DashboardTodoRow>(
    `
      select ${SELECT_FIELDS}
      from dashboard_todos
      inner join businesses on businesses.id = dashboard_todos.business_id
      order by dashboard_todos.created_at asc, dashboard_todos.id asc
    `,
    [],
    { operationName: "find_dashboard_todos", context }
  );

  return { items: result.rows.map(mapRow) };
}

export async function findDashboardTodoById(
  id: string,
  context: OperationContext
): Promise<DashboardTodoRead | null> {
  const result = await query<DashboardTodoRow>(
    `
      select ${SELECT_FIELDS}
      from dashboard_todos
      inner join businesses on businesses.id = dashboard_todos.business_id
      where dashboard_todos.id = $1::uuid
    `,
    [id],
    { operationName: "find_dashboard_todo_by_id", context }
  );

  if (result.rows.length === 0) {
    return null;
  }
  return mapRow(result.rows[0]!);
}

export async function insertDashboardTodo(
  input: DashboardTodoCreate,
  context: OperationContext
): Promise<DashboardTodoRead | null> {
  const insertResult = await query<{ id: string }>(
    `
      insert into dashboard_todos (business_id, title, completed)
      select b.id, $2, false
      from businesses b
      where b.id = $1::uuid
      returning dashboard_todos.id
    `,
    [input.business_id, input.title],
    { operationName: "insert_dashboard_todo", context }
  );

  if (insertResult.rows.length === 0) {
    return null;
  }

  return findDashboardTodoById(insertResult.rows[0]!.id, context);
}

export async function updateDashboardTodoCompleted(
  id: string,
  completed: boolean,
  context: OperationContext
): Promise<DashboardTodoRead | null> {
  const result = await query<DashboardTodoRow>(
    `
      update dashboard_todos dt
      set completed = $2, updated_at = now()
      from businesses b
      where dt.id = $1::uuid
        and b.id = dt.business_id
      returning ${UPDATE_RETURNING_FIELDS}
    `,
    [id, completed],
    { operationName: "update_dashboard_todo_completed", context }
  );

  if (result.rows.length === 0) {
    return null;
  }
  return mapRow(result.rows[0]!);
}

export async function deleteCompletedDashboardTodos(
  context: OperationContext
): Promise<number> {
  const result = await query(
    `delete from dashboard_todos where completed = true`,
    [],
    { operationName: "delete_completed_dashboard_todos", context }
  );
  return result.rowCount ?? 0;
}
