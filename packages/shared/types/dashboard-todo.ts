import type { LeadStatus } from "../constants/domain";
import type {
  DASHBOARD_TODO_PRIORITIES,
  DASHBOARD_TODO_STATUSES,
} from "../constants/pagination";

export type DashboardTodoStatus = (typeof DASHBOARD_TODO_STATUSES)[number];
export type DashboardTodoPriority = (typeof DASHBOARD_TODO_PRIORITIES)[number];

export interface DashboardTodoAssignee {
  id: string;
  first_name: string;
  last_name: string;
}

export interface DashboardTodoAssigneesResponse {
  items: DashboardTodoAssignee[];
}

export interface DashboardTodoRead {
  id: string;
  name: string;
  /** Brief task notes; nullable when unset. */
  description: string | null;
  business_id: string | null;
  business_name: string | null;
  business_status: LeadStatus | null;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  status: DashboardTodoStatus;
  /** ISO date string `YYYY-MM-DD`, nullable. */
  start_date: string | null;
  priority: DashboardTodoPriority;
  created_at: string;
  updated_at: string;
}

export interface DashboardTodosListResponse {
  items: DashboardTodoRead[];
}

export interface DashboardTodoCreate {
  name: string;
  description?: string | null;
  business_id?: string | null;
  assigned_user_id?: string | null;
  status?: DashboardTodoStatus;
  start_date?: string | null;
  priority?: DashboardTodoPriority;
}

export interface DashboardTodoUpdate {
  name?: string;
  description?: string | null;
  status?: DashboardTodoStatus;
  start_date?: string | null;
  priority?: DashboardTodoPriority;
}

export interface DashboardTodosDeletedResponse {
  deleted: number;
}
