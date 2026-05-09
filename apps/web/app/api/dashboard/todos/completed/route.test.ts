import { beforeEach, describe, expect, it, vi } from "vitest";

const removeCompletedDashboardTodosMock = vi.fn();

vi.mock("@/lib/services/dashboard-todo-service", () => ({
  removeCompletedDashboardTodos: removeCompletedDashboardTodosMock,
}));

describe("DELETE /api/dashboard/todos/completed", () => {
  beforeEach(() => {
    removeCompletedDashboardTodosMock.mockReset();
  });

  it("deletes completed tasks", async () => {
    removeCompletedDashboardTodosMock.mockResolvedValue({ deleted: 2 });

    const response = await import("./route").then(({ DELETE }) =>
      DELETE(new Request("http://localhost/api/dashboard/todos/completed", { method: "DELETE" }))
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ deleted: 2 });
  });
});
