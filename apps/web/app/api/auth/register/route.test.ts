import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimitsForTests } from "@/lib/auth/rate-limit";

const registerUserMock = vi.fn();

vi.mock("@/lib/services/auth-service", () => ({
  registerUser: registerUserMock,
}));

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    registerUserMock.mockReset();
    resetRateLimitsForTests();
  });

  it("creates a user with valid registration payload", async () => {
    registerUserMock.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      username: "new-user",
      email: "new-user@example.com",
      first_name: "New",
      last_name: "User",
      phone: null,
      role: "user",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      last_login_at: null,
    });

    const response = await import("./route").then(({ POST }) =>
      POST(
        new Request("http://localhost/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: "new-user",
            email: "new-user@example.com",
            firstName: "New",
            lastName: "User",
            phone: "",
            password: "super-secret-123",
          }),
        }),
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.user.email).toBe("new-user@example.com");
    expect(registerUserMock).toHaveBeenCalledTimes(1);
  });

  it("rate limits repeated registration attempts per email", async () => {
    registerUserMock.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      username: "new-user",
      email: "new-user@example.com",
      first_name: "New",
      last_name: "User",
      phone: null,
      role: "user",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      last_login_at: null,
    });

    for (let i = 0; i < 5; i += 1) {
      const response = await import("./route").then(({ POST }) =>
        POST(
          new Request("http://localhost/api/auth/register", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Forwarded-For": "203.0.113.11",
            },
            body: JSON.stringify({
              username: "new-user",
              email: "new-user@example.com",
              firstName: "New",
              lastName: "User",
              phone: "",
              password: "super-secret-123",
            }),
          }),
        ),
      );
      expect(response.status).toBe(201);
    }

    const blocked = await import("./route").then(({ POST }) =>
      POST(
        new Request("http://localhost/api/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Forwarded-For": "203.0.113.11",
          },
          body: JSON.stringify({
            username: "new-user",
            email: "new-user@example.com",
            firstName: "New",
            lastName: "User",
            phone: "",
            password: "super-secret-123",
          }),
        }),
      ),
    );
    const body = await blocked.json();

    expect(blocked.status).toBe(429);
    expect(body.error.code).toBe("too_many_requests");
    expect(registerUserMock).toHaveBeenCalledTimes(5);
  });
});
