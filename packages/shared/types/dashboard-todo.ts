import type { LeadStatus } from "../constants/domain";
import type {
  DASHBOARD_TODO_PRIORITIES,
  DASHBOARD_TODO_STATUSES,
} from "../constants/pagination";

export type DashboardTodoStatus = (typeof DASHBOARD_TODO_STATUSES)[number];
export type DashboardTodoPriority = (typeof DASHBOARD_TODO_PRIORITIES)[number];

export interface DashboardTodoRead {
  id: string;
  name: string;
  business_id: string;
  business_name: string;
  business_status: LeadStatus;
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
  business_id: string;
  status?: DashboardTodoStatus;
  start_date?: string | null;
  priority?: DashboardTodoPriority;
}

export interface DashboardTodoUpdate {
  name?: string;
  status?: DashboardTodoStatus;
  start_date?: string | null;
  priority?: DashboardTodoPriority;
}

export interface DashboardTodosDeletedResponse {
  deleted: number;
}
