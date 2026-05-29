import { beforeEach, describe, expect, it, vi } from "vitest";

const listDashboardTodosMock = vi.fn();
const createDashboardTodoMock = vi.fn();

vi.mock("@/lib/services/dashboard-todo-service", () => ({
  listDashboardTodos: listDashboardTodosMock,
  createDashboardTodo: createDashboardTodoMock,
}));

const SAMPLE_READ = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Hello",
  business_id: "00000000-0000-4000-8000-000000000002",
  business_name: "Acme",
  business_status: "new",
  assigned_user_id: null,
  assigned_user_name: null,
  status: "pending",
  start_date: null,
  priority: "medium",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

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

  it("creates a task with default status and priority", async () => {
    createDashboardTodoMock.mockResolvedValue(SAMPLE_READ);

    const response = await import("./route").then(({ POST }) =>
      POST(
        new Request("http://localhost/api/dashboard/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Hello",
            business_id: "00000000-0000-4000-8000-000000000002",
          }),
        })
      )
    );

    expect(response.status).toBe(201);
    expect(createDashboardTodoMock).toHaveBeenCalledWith(
      {
        name: "Hello",
        business_id: "00000000-0000-4000-8000-000000000002",
      },
      expect.objectContaining({
        route: "/api/dashboard/todos",
        method: "POST",
      })
    );
  });

  it("creates a task with priority and start date", async () => {
    createDashboardTodoMock.mockResolvedValue({
      ...SAMPLE_READ,
      priority: "high",
      start_date: "2026-05-12",
    });

    const response = await import("./route").then(({ POST }) =>
      POST(
        new Request("http://localhost/api/dashboard/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Plan launch",
            business_id: "00000000-0000-4000-8000-000000000002",
            priority: "high",
            start_date: "2026-05-12",
          }),
        })
      )
    );

    expect(response.status).toBe(201);
    expect(createDashboardTodoMock).toHaveBeenCalledWith(
      {
        name: "Plan launch",
        business_id: "00000000-0000-4000-8000-000000000002",
        priority: "high",
        start_date: "2026-05-12",
      },
      expect.anything()
    );
  });

  it("rejects invalid payloads", async () => {
    const response = await import("./route").then(({ POST }) =>
      POST(
        new Request("http://localhost/api/dashboard/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "",
            business_id: "00000000-0000-4000-8000-000000000002",
            priority: "urgent",
          }),
        })
      )
    );

    expect(response.status).toBe(400);
    expect(createDashboardTodoMock).not.toHaveBeenCalled();
  });

  it("creates a task without a linked business", async () => {
    createDashboardTodoMock.mockResolvedValue({
      ...SAMPLE_READ,
      business_id: null,
      business_name: null,
      business_status: null,
    });

    const response = await import("./route").then(({ POST }) =>
      POST(
        new Request("http://localhost/api/dashboard/todos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Internal follow-up",
          }),
        })
      )
    );

    expect(response.status).toBe(201);
    expect(createDashboardTodoMock).toHaveBeenCalledWith(
      {
        name: "Internal follow-up",
      },
      expect.anything()
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
            name: "Hello",
            business_id: "00000000-0000-4000-8000-000000000002",
          }),
        })
      )
    );

    expect(response.status).toBe(404);
  });
});
