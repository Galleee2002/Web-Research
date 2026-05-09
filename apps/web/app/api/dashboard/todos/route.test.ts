import { beforeEach, describe, expect, it, vi } from "vitest";

const listDashboardTodosMock = vi.fn();
const createDashboardTodoMock = vi.fn();

vi.mock("@/lib/services/dashboard-todo-service", () => ({
  listDashboardTodos: listDashboardTodosMock,
  createDashboardTodo: createDashboardTodoMock,
}));

describe("GET /api/dashboard/todos", () => {
  beforeEach(() => {
    listDashboardTodosMock.mockReset();
    createDashboardTodoMock.mockReset();
  });

  it("returns the todo list", async () => {
    listDashboardTodosMock.mockResolvedValue({ items: [] });

    const response = await import("./route").then(({ GET }) =>
      GET(new Request("http://localhost/api/dashboard/todos"))
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ items: [] });
  });
});

describe("POST /api/dashboard/todos", () => {
  beforeEach(() => {
    listDashboardTodosMock.mockReset();
    createDashboardTodoMock.mockReset();
  });

  it("creates a task", async () => {
    createDashboardTodoMock.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000001",
      title: "Hello",
      business_id: "00000000-0000-4000-8000-000000000002",
      business_name: "Acme",
      business_status: "new",
      completed: false,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });

    const response = await import("./route").then(({ POST }) =>
      POST(
        new Request("http://localhost/api/dashboard/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Hello",
            business_id: "00000000-0000-4000-8000-000000000002",
          }),
        })
      )
    );

    expect(response.status).toBe(201);
    expect(createDashboardTodoMock).toHaveBeenCalledWith(
      {
        title: "Hello",
        business_id: "00000000-0000-4000-8000-000000000002",
      },
      expect.objectContaining({
        route: "/api/dashboard/todos",
        method: "POST",
      })
    );
  });

  it("returns 404 when the business does not exist", async () => {
    createDashboardTodoMock.mockResolvedValue(null);

    const response = await import("./route").then(({ POST }) =>
      POST(
        new Request("http://localhost/api/dashboard/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Hello",
            business_id: "00000000-0000-4000-8000-000000000002",
          }),
        })
      )
    );

    expect(response.status).toBe(404);
  });
});
