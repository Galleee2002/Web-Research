import { describe, expect, it } from "vitest";

import {
  AUTH_TOKEN_VERSION,
  clearSessionCookie,
  setSessionCookie,
  signSessionToken,
  verifySessionToken,
} from "./session";

const secret = "test-secret-at-least-32-characters-long";

describe("auth sessions", () => {
  it("signs and verifies a JWT session payload", async () => {
    const token = await signSessionToken(
      {
        sub: "11111111-1111-4111-8111-111111111111",
        username: "admin",
        email: "admin@example.com",
        role: "admin",
        sessionVersion: 3,
      },
      { secret, ttlSeconds: 60, now: 1_700_000_000 },
    );

    const payload = await verifySessionToken(token, {
      secret,
      now: 1_700_000_010,
    });

    expect(payload).toEqual({
      version: AUTH_TOKEN_VERSION,
      sub: "11111111-1111-4111-8111-111111111111",
      username: "admin",
      email: "admin@example.com",
      role: "admin",
      sessionVersion: 3,
      iat: 1_700_000_000,
      exp: 1_700_000_060,
    });
  });

  it("rejects expired or tampered JWT sessions", async () => {
    const token = await signSessionToken(
      {
        sub: "11111111-1111-4111-8111-111111111111",
        username: "user",
        email: "user@example.com",
        role: "user",
        sessionVersion: 1,
      },
      { secret, ttlSeconds: 60, now: 1_700_000_000 },
    );

    await expect(
      verifySessionToken(token, { secret, now: 1_700_000_061 }),
    ).resolves.toBeNull();
    await expect(
      verifySessionToken(`${token.slice(0, -1)}x`, { secret, now: 1_700_000_010 }),
    ).resolves.toBeNull();
  });

  it("sets and clears the HttpOnly session cookie", () => {
    const response = new Response();
    setSessionCookie(response, "token-value", {
      cookieName: "blf_session",
      ttlSeconds: 3600,
      secure: true,
    });

    expect(response.headers.get("Set-Cookie")).toContain("blf_session=token-value");
    expect(response.headers.get("Set-Cookie")).toContain("HttpOnly");
    expect(response.headers.get("Set-Cookie")).toContain("Secure");
    expect(response.headers.get("Set-Cookie")).toContain("SameSite=Lax");

    clearSessionCookie(response, { cookieName: "blf_session", secure: true });
    expect(response.headers.getSetCookie().at(-1)).toContain("Max-Age=0");
  });
});
