import { beforeEach, describe, expect, it, vi } from "vitest";

const listUsersMock = vi.fn();
const requireRoleMock = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/lib/services/auth-service", () => ({
  listUsers: listUsersMock,
}));

describe("GET /api/admin/users", () => {
  beforeEach(() => {
    listUsersMock.mockReset();
    requireRoleMock.mockReset();
  });

  it("requires an admin session and returns users", async () => {
    requireRoleMock.mockResolvedValue({
      sub: "11111111-1111-4111-8111-111111111111",
      username: "admin",
      email: "admin@example.com",
      role: "admin",
      iat: 1,
      exp: 2,
      version: 1,
    });
    listUsersMock.mockResolvedValue([
      {
        id: "22222222-2222-4222-8222-222222222222",
        username: "user",
        email: "user@example.com",
        first_name: "Regular",
        last_name: "User",
        phone: null,
        role: "user",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        last_login_at: null,
      },
    ]);

    const response = await import("./route").then(({ GET }) =>
      GET(
        new Request("http://localhost/api/admin/users", {
          headers: { "X-Correlation-Id": "corr-admin-users" },
        }),
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(requireRoleMock).toHaveBeenCalledWith(
      expect.any(Request),
      ["admin"],
      {
        correlationId: "corr-admin-users",
        method: "GET",
        route: "/api/admin/users",
      },
    );
    expect(listUsersMock).toHaveBeenCalledWith({
      correlationId: "corr-admin-users",
      method: "GET",
      route: "/api/admin/users",
    });
  });
});
