/**
 * Dashboard To Do row for the home card (backed by `/api/dashboard/todos`).
 */
export type DashboardTodoItem = {
  id: string;
  title: string;
  businessName: string | null;
  /** Display segment after the business name (e.g. lead status label). */
  statusLabel: string;
  completed: boolean;
  /** Row still being composed (title input + business picker). */
  isDraft?: boolean;
};
