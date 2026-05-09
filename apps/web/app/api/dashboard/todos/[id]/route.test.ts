import { beforeEach, describe, expect, it, vi } from "vitest";

const setDashboardTodoCompletedMock = vi.fn();

vi.mock("@/lib/services/dashboard-todo-service", () => ({
  setDashboardTodoCompleted: setDashboardTodoCompletedMock,
}));

describe("PATCH /api/dashboard/todos/[id]", () => {
  beforeEach(() => {
    setDashboardTodoCompletedMock.mockReset();
  });

  it("updates completed", async () => {
    setDashboardTodoCompletedMock.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000001",
      title: "Hello",
      business_id: "00000000-0000-4000-8000-000000000002",
      business_name: "Acme",
      business_status: "new",
      completed: true,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });

    const response = await import("./route").then(({ PATCH }) =>
      PATCH(
        new Request("http://localhost/api/dashboard/todos/x", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed: true }),
        }),
        {
          params: Promise.resolve({
            id: "00000000-0000-4000-8000-000000000001",
          }),
        }
      )
    );

    expect(response.status).toBe(200);
    expect(setDashboardTodoCompletedMock).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000001",
      { completed: true },
      expect.objectContaining({
        route: "/api/dashboard/todos/[id]",
        method: "PATCH",
      })
    );
  });

  it("returns 404 when the task does not exist", async () => {
    setDashboardTodoCompletedMock.mockResolvedValue(null);

    const response = await import("./route").then(({ PATCH }) =>
      PATCH(
        new Request("http://localhost/api/dashboard/todos/x", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed: true }),
        }),
        {
          params: Promise.resolve({
            id: "00000000-0000-4000-8000-000000000001",
          }),
        }
      )
    );

    expect(response.status).toBe(404);
  });
});
