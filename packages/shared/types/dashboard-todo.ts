import type { LeadStatus } from "../constants/domain";

export interface DashboardTodoRead {
  id: string;
  title: string;
  business_id: string;
  business_name: string;
  business_status: LeadStatus;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface DashboardTodosListResponse {
  items: DashboardTodoRead[];
}

export interface DashboardTodoCreate {
  title: string;
  business_id: string;
}

export interface DashboardTodoCompletedUpdate {
  completed: boolean;
}

export interface DashboardTodosDeletedResponse {
  deleted: number;
}
