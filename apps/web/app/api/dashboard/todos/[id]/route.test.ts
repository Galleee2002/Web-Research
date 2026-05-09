import { beforeEach, describe, expect, it, vi } from "vitest";

const updateDashboardTodoMock = vi.fn();

vi.mock("@/lib/services/dashboard-todo-service", () => ({
  updateDashboardTodo: updateDashboardTodoMock,
}));

const BASE_READ = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Hello",
  business_id: "00000000-0000-4000-8000-000000000002",
  business_name: "Acme",
  business_status: "new",
  status: "pending",
  start_date: null,
  priority: "medium",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("PATCH /api/dashboard/todos/[id]", () => {
  beforeEach(() => {
    updateDashboardTodoMock.mockReset();
  });

  it("updates status", async () => {
    updateDashboardTodoMock.mockResolvedValue({ ...BASE_READ, status: "completed" });

    const response = await import("./route").then(({ PATCH }) =>
      PATCH(
        new Request("http://localhost/api/dashboard/todos/x", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "completed" }),
        }),
        {
          params: Promise.resolve({
            id: "00000000-0000-4000-8000-000000000001",
          }),
        }
      )
    );

    expect(response.status).toBe(200);
    expect(updateDashboardTodoMock).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000001",
      { status: "completed" },
      expect.objectContaining({
        route: "/api/dashboard/todos/[id]",
        method: "PATCH",
      })
    );
  });

  it("updates priority and start_date", async () => {
    updateDashboardTodoMock.mockResolvedValue({
      ...BASE_READ,
      priority: "high",
      start_date: "2026-06-01",
    });

    const response = await import("./route").then(({ PATCH }) =>
      PATCH(
        new Request("http://localhost/api/dashboard/todos/x", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ priority: "high", start_date: "2026-06-01" }),
        }),
        {
          params: Promise.resolve({
            id: "00000000-0000-4000-8000-000000000001",
          }),
        }
      )
    );

    expect(response.status).toBe(200);
    expect(updateDashboardTodoMock).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000001",
      { priority: "high", start_date: "2026-06-01" },
      expect.anything()
    );
  });

  it("rejects an empty payload", async () => {
    const response = await import("./route").then(({ PATCH }) =>
      PATCH(
        new Request("http://localhost/api/dashboard/todos/x", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }),
        {
          params: Promise.resolve({
            id: "00000000-0000-4000-8000-000000000001",
          }),
        }
      )
    );

    expect(response.status).toBe(400);
    expect(updateDashboardTodoMock).not.toHaveBeenCalled();
  });

  it("rejects invalid id", async () => {
    const response = await import("./route").then(({ PATCH }) =>
      PATCH(
        new Request("http://localhost/api/dashboard/todos/x", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "completed" }),
        }),
        {
          params: Promise.resolve({ id: "not-uuid" }),
        }
      )
    );

    expect(response.status).toBe(400);
    expect(updateDashboardTodoMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the task does not exist", async () => {
    updateDashboardTodoMock.mockResolvedValue(null);

    const response = await import("./route").then(({ PATCH }) =>
      PATCH(
        new Request("http://localhost/api/dashboard/todos/x", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "completed" }),
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
