import type {
  AuthLogin,
  AuthProfileUpdate,
  AuthRegistration,
  AuthUser,
  UserRole,
} from "@shared/index";

import { ApiError, type OperationContext } from "@/lib/api/http";
import { hashPassword as defaultHashPassword, verifyPassword as defaultVerifyPassword } from "@/lib/auth/password";
import { signSessionToken as defaultSignSessionToken } from "@/lib/auth/session";
import {
  createUser as defaultCreateUser,
  findUserByEmailOrUsername as defaultFindUserByEmailOrUsername,
  findUserById as defaultFindUserById,
  incrementUserSessionVersion as defaultIncrementUserSessionVersion,
  listUsers as defaultListUsers,
  markUserLogin as defaultMarkUserLogin,
  updateUserProfile as defaultUpdateUserProfile,
  updateUserRole as defaultUpdateUserRole,
} from "@/lib/db/users";

interface AuthServiceDependencies {
  createUser: typeof defaultCreateUser;
  findUserByEmailOrUsername: typeof defaultFindUserByEmailOrUsername;
  findUserById: typeof defaultFindUserById;
  incrementUserSessionVersion: typeof defaultIncrementUserSessionVersion;
  listUsers: typeof defaultListUsers;
  markUserLogin: typeof defaultMarkUserLogin;
  updateUserProfile: typeof defaultUpdateUserProfile;
  updateUserRole: typeof defaultUpdateUserRole;
  hashPassword: typeof defaultHashPassword;
  verifyPassword: typeof defaultVerifyPassword;
  signSessionToken: typeof defaultSignSessionToken;
}

const defaultDeps = {
  createUser: defaultCreateUser,
  findUserByEmailOrUsername: defaultFindUserByEmailOrUsername,
  findUserById: defaultFindUserById,
  incrementUserSessionVersion: defaultIncrementUserSessionVersion,
  listUsers: defaultListUsers,
  markUserLogin: defaultMarkUserLogin,
  updateUserProfile: defaultUpdateUserProfile,
  updateUserRole: defaultUpdateUserRole,
  hashPassword: defaultHashPassword,
  verifyPassword: defaultVerifyPassword,
  signSessionToken: defaultSignSessionToken,
} satisfies AuthServiceDependencies;

function withDeps(deps: Partial<AuthServiceDependencies>): AuthServiceDependencies {
  return { ...defaultDeps, ...deps };
}

export async function registerUser(
  payload: AuthRegistration,
  context: OperationContext,
  deps: Partial<AuthServiceDependencies> = {},
): Promise<AuthUser> {
  const resolvedDeps = withDeps(deps);
  const existingByEmail = await resolvedDeps.findUserByEmailOrUsername(payload.email, context);
  const existingByUsername =
    payload.username === payload.email
      ? existingByEmail
      : await resolvedDeps.findUserByEmailOrUsername(payload.username, context);
  if (existingByEmail || existingByUsername) {
    throw new ApiError("conflict_error", "User already exists", 409);
  }

  return resolvedDeps.createUser(
    {
      username: payload.username,
      email: payload.email,
      first_name: payload.firstName,
      last_name: payload.lastName,
      phone: payload.phone,
      password_hash: await resolvedDeps.hashPassword(payload.password),
      role: "user",
    },
    context,
  );
}

export async function authenticateUser(
  payload: AuthLogin,
  context: OperationContext,
  deps: Partial<AuthServiceDependencies> = {},
): Promise<{ user: AuthUser; token: string }> {
  const resolvedDeps = withDeps(deps);
  const user = await resolvedDeps.findUserByEmailOrUsername(payload.emailOrUsername, context);
  if (!user || !(await resolvedDeps.verifyPassword(payload.password, user.password_hash))) {
    throw new ApiError("unauthorized", "Invalid credentials", 401);
  }

  const updatedUser = (await resolvedDeps.markUserLogin(user.id, context)) ?? user;
  const token = await resolvedDeps.signSessionToken({
    sub: updatedUser.id,
    username: updatedUser.username,
    email: updatedUser.email,
    role: updatedUser.role,
    sessionVersion: user.session_version,
  });

  return { user: updatedUser, token };
}

export async function getUserById(
  id: string,
  context: OperationContext,
  deps: Partial<AuthServiceDependencies> = {},
): Promise<AuthUser | null> {
  return withDeps(deps).findUserById(id, context);
}

export async function updateCurrentUserProfile(
  id: string,
  payload: AuthProfileUpdate,
  context: OperationContext,
  deps: Partial<AuthServiceDependencies> = {},
): Promise<AuthUser | null> {
  return withDeps(deps).updateUserProfile(id, payload, context);
}

export async function listUsers(
  context: OperationContext,
  deps: Partial<AuthServiceDependencies> = {},
): Promise<AuthUser[]> {
  return withDeps(deps).listUsers(context);
}

export async function updateUserRole(
  id: string,
  role: UserRole,
  context: OperationContext,
  deps: Partial<AuthServiceDependencies> = {},
): Promise<AuthUser | null> {
  return withDeps(deps).updateUserRole(id, role, context);
}

export async function revokeUserSessions(
  id: string,
  context: OperationContext,
  deps: Partial<AuthServiceDependencies> = {},
): Promise<void> {
  const updatedSessionVersion = await withDeps(deps).incrementUserSessionVersion(id, context);
  if (updatedSessionVersion === null) {
    throw new ApiError("not_found", "User not found", 404);
  }
}
