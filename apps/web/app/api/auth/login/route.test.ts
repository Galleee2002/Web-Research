import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimitsForTests } from "@/lib/auth/rate-limit";

const authenticateUserMock = vi.fn();

vi.mock("@/lib/services/auth-service", () => ({
  authenticateUser: authenticateUserMock,
}));

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    authenticateUserMock.mockReset();
    resetRateLimitsForTests();
  });

  it("sets the HttpOnly session cookie after successful login", async () => {
    authenticateUserMock.mockResolvedValue({
      token: "signed-token",
      user: {
        id: "11111111-1111-4111-8111-111111111111",
        username: "admin",
        email: "admin@example.com",
        first_name: "Admin",
        last_name: "User",
        phone: null,
        role: "admin",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        last_login_at: null,
      },
    });

    const response = await import("./route").then(({ POST }) =>
      POST(
        new Request("http://localhost/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Correlation-Id": "corr-login",
          },
          body: JSON.stringify({
            emailOrUsername: " admin@example.com ",
            password: "super-secret-123",
          }),
        }),
      ),
    );
    const body = await response.json();
    const setCookies = response.headers.getSetCookie();

    expect(response.status).toBe(200);
    expect(setCookies.some((cookie) => cookie.includes("blf_session=signed-token"))).toBe(true);
    expect(setCookies.some((cookie) => cookie.includes("HttpOnly"))).toBe(true);
    expect(setCookies.some((cookie) => cookie.includes("blf_csrf="))).toBe(true);
    expect(body.user.email).toBe("admin@example.com");
    expect(authenticateUserMock).toHaveBeenCalledWith(
      {
        emailOrUsername: "admin@example.com",
        password: "super-secret-123",
      },
      {
        correlationId: "corr-login",
        method: "POST",
        route: "/api/auth/login",
      },
    );
  });

  it("rejects invalid login payloads with the shared error envelope", async () => {
    const response = await import("./route").then(({ POST }) =>
      POST(
        new Request("http://localhost/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emailOrUsername: "", password: "short" }),
        }),
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("validation_error");
    expect(body.error.correlation_id).toEqual(expect.any(String));
    expect(authenticateUserMock).not.toHaveBeenCalled();
  });

  it("rate limits repeated login attempts per identity", async () => {
    authenticateUserMock.mockResolvedValue({
      token: "signed-token",
      user: {
        id: "11111111-1111-4111-8111-111111111111",
        username: "admin",
        email: "admin@example.com",
        first_name: "Admin",
        last_name: "User",
        phone: null,
        role: "admin",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
        last_login_at: null,
      },
    });

    for (let i = 0; i < 5; i += 1) {
      const response = await import("./route").then(({ POST }) =>
        POST(
          new Request("http://localhost/api/auth/login", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Forwarded-For": "203.0.113.10",
            },
            body: JSON.stringify({
              emailOrUsername: "admin@example.com",
              password: "super-secret-123",
            }),
          }),
        ),
      );
      expect(response.status).toBe(200);
    }

    const blocked = await import("./route").then(({ POST }) =>
      POST(
        new Request("http://localhost/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Forwarded-For": "203.0.113.10",
          },
          body: JSON.stringify({
            emailOrUsername: "admin@example.com",
            password: "super-secret-123",
          }),
        }),
      ),
    );
    const body = await blocked.json();

    expect(blocked.status).toBe(429);
    expect(body.error.code).toBe("too_many_requests");
    expect(authenticateUserMock).toHaveBeenCalledTimes(5);
  });
});
