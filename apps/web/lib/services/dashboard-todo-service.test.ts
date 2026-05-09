import { describe, expect, it, vi } from "vitest";

import {
  createDashboardTodo,
  listDashboardTodos,
  removeCompletedDashboardTodos,
  updateDashboardTodo,
} from "./dashboard-todo-service";

const context = {
  correlationId: "corr-1",
  method: "GET",
  route: "/api/dashboard/todos",
} as const;

const SAMPLE = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Plan launch",
  business_id: "00000000-0000-4000-8000-000000000002",
  business_name: "Acme",
  business_status: "new" as const,
  status: "pending" as const,
  start_date: null,
  priority: "medium" as const,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("dashboard todo service", () => {
  it("delegates listDashboardTodos to the repository", async () => {
    const findDashboardTodos = vi.fn().mockResolvedValue({ items: [SAMPLE] });

    const result = await listDashboardTodos(context, {
      findDashboardTodos,
      insertDashboardTodo: vi.fn(),
      updateDashboardTodo: vi.fn(),
      deleteCompletedDashboardTodos: vi.fn(),
    });

    expect(findDashboardTodos).toHaveBeenCalledWith(context);
    expect(result).toEqual({ items: [SAMPLE] });
  });

  it("creates todos through the repository preserving optional fields", async () => {
    const insertDashboardTodo = vi.fn().mockResolvedValue(SAMPLE);

    const result = await createDashboardTodo(
      {
        name: "Plan launch",
        business_id: "00000000-0000-4000-8000-000000000002",
        priority: "high",
        start_date: "2026-05-12",
      },
      context,
      {
        findDashboardTodos: vi.fn(),
        insertDashboardTodo,
        updateDashboardTodo: vi.fn(),
        deleteCompletedDashboardTodos: vi.fn(),
      }
    );

    expect(insertDashboardTodo).toHaveBeenCalledWith(
      {
        name: "Plan launch",
        business_id: "00000000-0000-4000-8000-000000000002",
        priority: "high",
        start_date: "2026-05-12",
      },
      context
    );
    expect(result).toEqual(SAMPLE);
  });

  it("forwards partial updates to the repository", async () => {
    const updateDashboardTodoMock = vi
      .fn()
      .mockResolvedValue({ ...SAMPLE, status: "completed" });

    const result = await updateDashboardTodo(
      SAMPLE.id,
      { status: "completed" },
      context,
      {
        findDashboardTodos: vi.fn(),
        insertDashboardTodo: vi.fn(),
        updateDashboardTodo: updateDashboardTodoMock,
        deleteCompletedDashboardTodos: vi.fn(),
      }
    );

    expect(updateDashboardTodoMock).toHaveBeenCalledWith(
      SAMPLE.id,
      { status: "completed" },
      context
    );
    expect(result?.status).toBe("completed");
  });

  it("returns the count of deleted completed todos", async () => {
    const deleteCompletedDashboardTodos = vi.fn().mockResolvedValue(3);

    const result = await removeCompletedDashboardTodos(context, {
      findDashboardTodos: vi.fn(),
      insertDashboardTodo: vi.fn(),
      updateDashboardTodo: vi.fn(),
      deleteCompletedDashboardTodos,
    });

    expect(deleteCompletedDashboardTodos).toHaveBeenCalledWith(context);
    expect(result).toEqual({ deleted: 3 });
  });
});
