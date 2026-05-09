import type {
  DashboardTodoPriority,
  DashboardTodoStatus,
} from "@shared/index";

/**
 * Dashboard To Do row for the home card (backed by `/api/dashboard/todos`).
 */
export type DashboardTodoItem = {
  id: string;
  name: string;
  businessName: string | null;
  /** Display label for the linked business lead status (e.g. "Reviewed"). */
  businessStatusLabel: string;
  status: DashboardTodoStatus;
  /** ISO date string `YYYY-MM-DD`, nullable. */
  startDate: string | null;
  priority: DashboardTodoPriority;
  /** Row still being composed (name input + business picker + extras). */
  isDraft?: boolean;
};
