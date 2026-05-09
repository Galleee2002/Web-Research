/**
 * Shape aligned with a future dashboard todos API.
 * Keep fields stable when wiring `PATCH` / `POST` routes.
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
