import type {
  DashboardTodoCreate,
  DashboardTodoRead,
  DashboardTodoUpdate,
  DashboardTodosListResponse,
} from "@shared/index";

import type { OperationContext } from "@/lib/api/http";

import { query } from "./pool";
import { toIsoString } from "./shared-query";

interface DashboardTodoRow {
  id: string;
  name: string;
  business_id: string | null;
  business_name: string | null;
  business_status: DashboardTodoRead["business_status"];
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  status: DashboardTodoRead["status"];
  start_date: Date | string | null;
  priority: DashboardTodoRead["priority"];
  created_at: Date | string;
  updated_at: Date | string;
}

const SELECT_FIELDS = `
  dashboard_todos.id,
  dashboard_todos.name,
  dashboard_todos.business_id,
  businesses.name as business_name,
  businesses.status as business_status,
  dashboard_todos.assigned_user_id,
  nullif(
    trim(
      coalesce(users.first_name, '') || ' ' || coalesce(users.last_name, '')
    ),
    ''
  ) as assigned_user_name,
  dashboard_todos.status,
  dashboard_todos.start_date,
  dashboard_todos.priority,
  dashboard_todos.created_at,
  dashboard_todos.updated_at
`;

const TODO_JOINS = `
  from dashboard_todos
  left join businesses on businesses.id = dashboard_todos.business_id
  left join users on users.id = dashboard_todos.assigned_user_id
`;

function toIsoDateString(value: Date | string | null): string | null {
  if (value === null) {
    return null;
  }
  if (value instanceof Date) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  // pg may return the column as `YYYY-MM-DD` already.
  return value.length >= 10 ? value.slice(0, 10) : value;
}

function mapRow(row: DashboardTodoRow): DashboardTodoRead {
  return {
    id: row.id,
    name: row.name,
    business_id: row.business_id,
    business_name: row.business_name,
    business_status: row.business_status,
    assigned_user_id: row.assigned_user_id,
    assigned_user_name: row.assigned_user_name,
    status: row.status,
    start_date: toIsoDateString(row.start_date),
    priority: row.priority,
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
      ${TODO_JOINS}
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
      ${TODO_JOINS}
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
  const status = input.status ?? "pending";
  const priority = input.priority ?? "medium";
  const startDate = input.start_date ?? null;
  const businessId = input.business_id ?? null;
  const assignedUserId = input.assigned_user_id ?? null;

  const insertResult = await query<{ id: string }>(
    `
      insert into dashboard_todos (
        business_id, assigned_user_id, name, status, start_date, priority
      )
      select $1::uuid, $2::uuid, $3, $4, $5::date, $6
      where ($1::uuid is null or exists (select 1 from businesses b where b.id = $1::uuid))
        and ($2::uuid is null or exists (select 1 from users u where u.id = $2::uuid))
      returning dashboard_todos.id
    `,
    [businessId, assignedUserId, input.name, status, startDate, priority],
    { operationName: "insert_dashboard_todo", context }
  );

  if (insertResult.rows.length === 0) {
    return null;
  }

  return findDashboardTodoById(insertResult.rows[0]!.id, context);
}

export async function updateDashboardTodo(
  id: string,
  patch: DashboardTodoUpdate,
  context: OperationContext
): Promise<DashboardTodoRead | null> {
  const sets: string[] = [];
  const params: unknown[] = [id];

  if (patch.name !== undefined) {
    params.push(patch.name);
    sets.push(`name = $${params.length}`);
  }
  if (patch.status !== undefined) {
    params.push(patch.status);
    sets.push(`status = $${params.length}`);
  }
  if (patch.priority !== undefined) {
    params.push(patch.priority);
    sets.push(`priority = $${params.length}`);
  }
  if (patch.start_date !== undefined) {
    params.push(patch.start_date);
    sets.push(`start_date = $${params.length}::date`);
  }

  if (sets.length === 0) {
    return findDashboardTodoById(id, context);
  }

  sets.push(`updated_at = now()`);

  const result = await query<{ id: string }>(
    `
      update dashboard_todos
      set ${sets.join(", ")}
      where id = $1::uuid
      returning id
    `,
    params,
    { operationName: "update_dashboard_todo", context }
  );

  if (result.rows.length === 0) {
    return null;
  }
  return findDashboardTodoById(result.rows[0]!.id, context);
}

export async function deleteCompletedDashboardTodos(
  context: OperationContext
): Promise<number> {
  const result = await query(
    `delete from dashboard_todos where status = 'completed'`,
    [],
    { operationName: "delete_completed_dashboard_todos", context }
  );
  return result.rowCount ?? 0;
}

export async function findDashboardTodoAssignees(
  context: OperationContext
): Promise<{ id: string; first_name: string; last_name: string }[]> {
  const result = await query<{ id: string; first_name: string; last_name: string }>(
    `
      select id, first_name, last_name
      from users
      order by lower(first_name), lower(last_name), created_at asc
    `,
    [],
    { operationName: "find_dashboard_todo_assignees", context }
  );

  return result.rows;
}
