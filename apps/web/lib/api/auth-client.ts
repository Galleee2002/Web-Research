import type {
  AuthLogin,
  AuthProfileUpdate,
  AuthRegistration,
  AuthUser,
  UserRoleUpdate,
} from "@shared/index";

import { readJsonBody, toApiClientError } from "./request";

type UserResponse = { user: AuthUser };
type UsersResponse = { items: AuthUser[] };

async function requestJson<T>(
  path: string,
  init: RequestInit,
  fallbackMessage: string,
): Promise<T> {
  const csrfHeader = getCsrfHeader(init.method);
  const response = await fetch(path, {
    credentials: "include",
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...csrfHeader,
      ...init.headers,
    },
  });
  const body = await readJsonBody(response);
  if (!response.ok) {
    if (shouldRedirectToLogin(path, response.status)) {
      window.location.replace("/login?reason=session_expired");
    }
    throw toApiClientError(response, body, fallbackMessage);
  }
  return body as T;
}

function getCsrfHeader(method: RequestInit["method"]): Record<string, string> {
  const normalizedMethod = (method ?? "GET").toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(normalizedMethod)) {
    return {};
  }
  if (typeof document === "undefined") {
    return {};
  }
  const token = readCookie("blf_csrf");
  return token ? { "X-CSRF-Token": token } : {};
}

function readCookie(name: string): string | null {
  const cookieString = typeof document === "undefined" ? "" : document.cookie;
  if (!cookieString) {
    return null;
  }
  for (const entry of cookieString.split(";")) {
    const [cookieName, ...valueParts] = entry.trim().split("=");
    if (cookieName === name) {
      return decodeURIComponent(valueParts.join("="));
    }
  }
  return null;
}

function shouldRedirectToLogin(path: string, status: number): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  if (!path.startsWith("/api/auth/me")) {
    return false;
  }
  return status === 401 || status === 403;
}

export async function register(payload: AuthRegistration): Promise<AuthUser> {
  const body = await requestJson<UserResponse>(
    "/api/auth/register",
    { method: "POST", body: JSON.stringify(payload) },
    "Unable to register user",
  );
  return body.user;
}

export async function login(payload: AuthLogin): Promise<AuthUser> {
  const body = await requestJson<UserResponse>(
    "/api/auth/login",
    { method: "POST", body: JSON.stringify(payload) },
    "Unable to log in",
  );
  return body.user;
}

export async function logout(): Promise<void> {
  await requestJson<{ ok: true }>(
    "/api/auth/logout",
    { method: "POST" },
    "Unable to log out",
  );
}

export async function getCurrentUser(): Promise<AuthUser> {
  const body = await requestJson<UserResponse>(
    "/api/auth/me",
    { method: "GET" },
    "Unable to load current user",
  );
  return body.user;
}

export async function updateCurrentUser(payload: AuthProfileUpdate): Promise<AuthUser> {
  const body = await requestJson<UserResponse>(
    "/api/auth/me",
    { method: "PATCH", body: JSON.stringify(payload) },
    "Unable to update profile",
  );
  return body.user;
}

export async function listAdminUsers(): Promise<AuthUser[]> {
  const body = await requestJson<UsersResponse>(
    "/api/admin/users",
    { method: "GET" },
    "Unable to load users",
  );
  return body.items;
}

export async function updateAdminUserRole(
  id: string,
  payload: UserRoleUpdate,
): Promise<AuthUser> {
  const body = await requestJson<UserResponse>(
    `/api/admin/users/${id}/role`,
    { method: "PATCH", body: JSON.stringify(payload) },
    "Unable to update user role",
  );
  return body.user;
}
