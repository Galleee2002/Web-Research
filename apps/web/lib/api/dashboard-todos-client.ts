import type {
  DashboardTodoCreate,
  DashboardTodoRead,
  DashboardTodoUpdate,
  DashboardTodosDeletedResponse,
  DashboardTodosListResponse,
} from "@shared/index";

import { leadStatusLabel } from "@/app/shared/model/status-label";
import type { DashboardTodoItem } from "@/lib/dashboard/todo-types";

import {
  ApiClientError,
  readJsonBody,
  toApiClientError,
} from "@/lib/api/request";

export { ApiClientError as DashboardTodosApiError };

const defaultTodoFetchInit: RequestInit = {
  credentials: "same-origin",
  cache: "no-store",
};

function getCsrfHeader(method: RequestInit["method"]): Record<string, string> {
  const normalizedMethod = (method ?? "GET").toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(normalizedMethod)) {
    return {};
  }
  if (typeof document === "undefined") {
    return {};
  }
  const token = readCookie("blf_csrf");
  return token ? { "X-CSRF-Token": token } : {};
}

function readCookie(name: string): string | null {
  const cookieString = typeof document === "undefined" ? "" : document.cookie;
  if (!cookieString) {
    return null;
  }
  for (const entry of cookieString.split(";")) {
    const [cookieName, ...valueParts] = entry.trim().split("=");
    if (cookieName === name) {
      return decodeURIComponent(valueParts.join("="));
    }
  }
  return null;
}

export function mapDashboardTodoReadToItem(row: DashboardTodoRead): DashboardTodoItem {
  return {
    id: row.id,
    name: row.name,
    businessName: row.business_name,
    businessStatusLabel: leadStatusLabel(row.business_status),
    status: row.status,
    startDate: row.start_date,
    priority: row.priority,
  };
}

export async function fetchDashboardTodos(init?: RequestInit): Promise<DashboardTodoItem[]> {
  const response = await fetch("/api/dashboard/todos", {
    ...defaultTodoFetchInit,
    method: "GET",
    headers: { Accept: "application/json" },
    ...init,
  });
  const body = await readJsonBody(response);
  if (!response.ok) {
    throw toApiClientError(
      response,
      body,
      `Request failed with status ${response.status}`
    );
  }
  const list = body as DashboardTodosListResponse;
  return (list.items ?? []).map(mapDashboardTodoReadToItem);
}

export async function createDashboardTodo(
  payload: DashboardTodoCreate,
  init?: RequestInit
): Promise<DashboardTodoItem> {
  const csrfHeader = getCsrfHeader("POST");
  const response = await fetch("/api/dashboard/todos", {
    ...defaultTodoFetchInit,
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...csrfHeader,
    },
    body: JSON.stringify(payload),
    ...init,
  });
  const body = await readJsonBody(response);
  if (!response.ok) {
    throw toApiClientError(
      response,
      body,
      `Request failed with status ${response.status}`
    );
  }
  return mapDashboardTodoReadToItem(body as DashboardTodoRead);
}

export async function patchDashboardTodo(
  id: string,
  payload: DashboardTodoUpdate,
  init?: RequestInit
): Promise<DashboardTodoItem> {
  const csrfHeader = getCsrfHeader("PATCH");
  const response = await fetch(`/api/dashboard/todos/${encodeURIComponent(id)}`, {
    ...defaultTodoFetchInit,
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...csrfHeader,
    },
    body: JSON.stringify(payload),
    ...init,
  });
  const body = await readJsonBody(response);
  if (!response.ok) {
    throw toApiClientError(
      response,
      body,
      `Request failed with status ${response.status}`
    );
  }
  return mapDashboardTodoReadToItem(body as DashboardTodoRead);
}

export async function deleteCompletedDashboardTodos(init?: RequestInit): Promise<number> {
  const csrfHeader = getCsrfHeader("DELETE");
  const response = await fetch("/api/dashboard/todos/completed", {
    ...defaultTodoFetchInit,
    method: "DELETE",
    headers: {
      Accept: "application/json",
      ...csrfHeader,
    },
    ...init,
  });
  const body = await readJsonBody(response);
  if (!response.ok) {
    throw toApiClientError(
      response,
      body,
      `Request failed with status ${response.status}`
    );
  }
  return (body as DashboardTodosDeletedResponse).deleted ?? 0;
}
