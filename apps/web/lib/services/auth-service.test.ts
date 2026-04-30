import { describe, expect, it, vi } from "vitest";

import { ApiError, type OperationContext } from "@/lib/api/http";

import { authenticateUser, registerUser, revokeUserSessions } from "./auth-service";

const context: OperationContext = {
  correlationId: "corr-auth-service",
  method: "POST",
  route: "/api/auth/test",
};

const user = {
  id: "11111111-1111-4111-8111-111111111111",
  username: "demo",
  email: "demo@example.com",
  first_name: "Demo",
  last_name: "User",
  phone: null,
  role: "user" as const,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  last_login_at: null,
};

describe("auth service", () => {
  it("registers a new user with a password hash and default user role", async () => {
    const createUser = vi.fn().mockResolvedValue(user);

    const result = await registerUser(
      {
        username: "demo",
        firstName: "Demo",
        lastName: "User",
        phone: null,
        email: "demo@example.com",
        password: "super-secret-123",
      },
      context,
      {
        createUser,
        findUserByEmailOrUsername: vi.fn().mockResolvedValue(null),
        hashPassword: vi.fn().mockResolvedValue("scrypt$hash"),
      },
    );

    expect(result).toEqual(user);
    expect(createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        username: "demo",
        email: "demo@example.com",
        role: "user",
        password_hash: expect.stringMatching(/^scrypt\$/),
      }),
      context,
    );
  });

  it("rejects duplicate registration identity before writing", async () => {
    await expect(
      registerUser(
        {
          username: "demo",
          firstName: "Demo",
          lastName: "User",
          phone: null,
          email: "demo@example.com",
          password: "super-secret-123",
        },
        context,
        {
          createUser: vi.fn(),
          findUserByEmailOrUsername: vi.fn().mockResolvedValue(user),
          hashPassword: vi.fn(),
        },
      ),
    ).rejects.toMatchObject(new ApiError("conflict_error", "User already exists", 409));
  });

  it("authenticates a user and updates last login", async () => {
    const signSessionToken = vi.fn().mockResolvedValue("signed-token");
    const findUserByEmailOrUsername = vi.fn().mockResolvedValue({
      ...user,
      password_hash: "scrypt$hash",
      session_version: 4,
    });
    const markUserLogin = vi.fn().mockResolvedValue(user);

    const result = await authenticateUser(
      { emailOrUsername: "demo@example.com", password: "super-secret-123" },
      context,
      {
        findUserByEmailOrUsername,
        markUserLogin,
        signSessionToken,
        verifyPassword: vi.fn().mockResolvedValue(true),
      },
    );

    expect(result.user).toEqual(user);
    expect(result.token).toBe("signed-token");
    expect(markUserLogin).toHaveBeenCalledWith(user.id, context);
    expect(signSessionToken).toHaveBeenCalledWith(
      expect.objectContaining({
        sub: user.id,
        sessionVersion: 4,
      }),
    );
  });

  it("rejects invalid credentials", async () => {
    await expect(
      authenticateUser(
        { emailOrUsername: "demo@example.com", password: "wrong-password" },
        context,
        {
          findUserByEmailOrUsername: vi.fn().mockResolvedValue({
            ...user,
            password_hash: "scrypt$hash",
            session_version: 1,
          }),
          verifyPassword: vi.fn().mockResolvedValue(false),
        },
      ),
    ).rejects.toMatchObject(new ApiError("unauthorized", "Invalid credentials", 401));
  });

  it("revokes active sessions by bumping session version", async () => {
    const incrementUserSessionVersion = vi.fn().mockResolvedValue(2);

    await expect(
      revokeUserSessions(user.id, context, {
        incrementUserSessionVersion,
      }),
    ).resolves.toBeUndefined();
    expect(incrementUserSessionVersion).toHaveBeenCalledWith(user.id, context);
  });
});
