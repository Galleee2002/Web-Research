import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuthMock = vi.fn();
const revokeUserSessionsMock = vi.fn();

vi.mock("@/lib/auth/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/session")>("@/lib/auth/session");
  return {
    ...actual,
    requireAuth: requireAuthMock,
  };
});

vi.mock("@/lib/services/auth-service", () => ({
  revokeUserSessions: revokeUserSessionsMock,
}));

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    requireAuthMock.mockReset();
    revokeUserSessionsMock.mockReset();
  });

  it("revokes user sessions and clears auth and csrf cookies", async () => {
    requireAuthMock.mockResolvedValue({
      sub: "11111111-1111-4111-8111-111111111111",
      username: "demo",
      email: "demo@example.com",
      role: "user",
      sessionVersion: 2,
      version: 1,
      iat: 1_700_000_000,
      exp: 1_700_000_060,
    });
    revokeUserSessionsMock.mockResolvedValue(undefined);

    const response = await import("./route").then(({ POST }) =>
      POST(new Request("http://localhost/api/auth/logout", { method: "POST" })),
    );
    const body = await response.json();
    const setCookies = response.headers.getSetCookie();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(revokeUserSessionsMock).toHaveBeenCalledTimes(1);
    expect(setCookies.some((cookie) => cookie.includes("blf_session=") && cookie.includes("Max-Age=0"))).toBe(true);
    expect(setCookies.some((cookie) => cookie.includes("blf_csrf=") && cookie.includes("Max-Age=0"))).toBe(true);
  });
});
