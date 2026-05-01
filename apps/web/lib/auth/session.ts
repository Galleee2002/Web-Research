import { isUserRole, type UserRole } from "@shared/index";

import { ApiError, type OperationContext } from "@/lib/api/http";
import { SESSION_INVALIDATED_MESSAGE } from "@/lib/auth/auth-messages";
import { getRuntimeConfig } from "@/lib/config/runtime";
import { getUserSessionVersion as defaultGetUserSessionVersion } from "@/lib/db/users";

export const AUTH_TOKEN_VERSION = 1;

export interface SessionTokenInput {
  sub: string;
  username: string;
  email: string;
  role: UserRole;
  sessionVersion: number;
}

export interface SessionTokenPayload extends SessionTokenInput {
  version: typeof AUTH_TOKEN_VERSION;
  iat: number;
  exp: number;
}

interface TokenOptions {
  secret?: string;
  ttlSeconds?: number;
  now?: number;
}

interface CookieOptions {
  cookieName?: string;
  ttlSeconds?: number;
  secure?: boolean;
}

interface SessionDependencies {
  getUserSessionVersion: typeof defaultGetUserSessionVersion;
}

const encoder = new TextEncoder();
const defaultDeps: SessionDependencies = {
  getUserSessionVersion: defaultGetUserSessionVersion,
};

export async function signSessionToken(
  input: SessionTokenInput,
  options: TokenOptions = {},
): Promise<string> {
  const config = getRuntimeConfig();
  const now = options.now ?? Math.floor(Date.now() / 1000);
  const ttlSeconds = options.ttlSeconds ?? config.authSessionTtlSeconds;
  const payload: SessionTokenPayload = {
    version: AUTH_TOKEN_VERSION,
    ...input,
    iat: now,
    exp: now + ttlSeconds,
  };
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = await hmacSha256(signingInput, options.secret ?? config.authJwtSecret);

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

export async function verifySessionToken(
  token: string,
  options: Pick<TokenOptions, "secret" | "now"> = {},
): Promise<SessionTokenPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expected = await hmacSha256(
    signingInput,
    options.secret ?? getRuntimeConfig().authJwtSecret,
  );
  const actual = base64UrlDecode(encodedSignature);
  if (!constantTimeEqual(expected, actual)) {
    return null;
  }

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedPayload)));
    const now = options.now ?? Math.floor(Date.now() / 1000);
    if (!isSessionPayload(payload) || payload.exp <= now) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function getSessionFromRequest(request: Request): Promise<SessionTokenPayload | null> {
  const cookieName = getRuntimeConfig().authCookieName;
  const token = parseCookies(request.headers.get("cookie")).get(cookieName);
  return token ? verifySessionToken(token) : null;
}

export async function requireAuth(
  request: Request,
  context?: OperationContext,
  deps: Partial<SessionDependencies> = {},
): Promise<SessionTokenPayload> {
  const session = await getSessionFromRequest(request);
  if (!session) {
    throw new ApiError("unauthorized", "Authentication is required", 401);
  }
  const resolvedDeps = { ...defaultDeps, ...deps };
  const operationContext =
    context ??
    {
      correlationId: crypto.randomUUID(),
      method: request.method,
      route: new URL(request.url).pathname,
    };
  const currentSessionVersion = await resolvedDeps.getUserSessionVersion(session.sub, operationContext);
  if (currentSessionVersion === null || currentSessionVersion !== session.sessionVersion) {
    throw new ApiError("unauthorized", SESSION_INVALIDATED_MESSAGE, 401);
  }
  return session;
}

export async function requireRole(
  request: Request,
  allowedRoles: UserRole[],
  context?: OperationContext,
  deps: Partial<SessionDependencies> = {},
): Promise<SessionTokenPayload> {
  const session = await requireAuth(request, context, deps);
  if (!allowedRoles.includes(session.role)) {
    throw new ApiError("forbidden", "Insufficient permissions", 403);
  }
  return session;
}

export function setSessionCookie(
  response: Response,
  token: string,
  options: CookieOptions = {},
): void {
  const config = getRuntimeConfig();
  response.headers.append(
    "Set-Cookie",
    serializeCookie(options.cookieName ?? config.authCookieName, token, {
      httpOnly: true,
      maxAge: options.ttlSeconds ?? config.authSessionTtlSeconds,
      path: "/",
      sameSite: "Lax",
      secure: options.secure ?? config.appEnv === "production",
    }),
  );
}

export function clearSessionCookie(response: Response, options: CookieOptions = {}): void {
  const config = getRuntimeConfig();
  response.headers.append(
    "Set-Cookie",
    serializeCookie(options.cookieName ?? config.authCookieName, "", {
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "Lax",
      secure: options.secure ?? config.appEnv === "production",
    }),
  );
}

export function createCsrfToken(): string {
  const randomPart = crypto.getRandomValues(new Uint8Array(24));
  return base64UrlEncode(randomPart);
}

export function setCsrfCookie(
  response: Response,
  token: string,
  options: Pick<CookieOptions, "cookieName" | "ttlSeconds" | "secure"> = {},
): void {
  const config = getRuntimeConfig();
  response.headers.append(
    "Set-Cookie",
    serializeCookie(options.cookieName ?? config.authCsrfCookieName, token, {
      httpOnly: false,
      maxAge: options.ttlSeconds ?? config.authSessionTtlSeconds,
      path: "/",
      sameSite: "Lax",
      secure: options.secure ?? config.appEnv === "production",
    }),
  );
}

export function clearCsrfCookie(
  response: Response,
  options: Pick<CookieOptions, "cookieName" | "secure"> = {},
): void {
  const config = getRuntimeConfig();
  response.headers.append(
    "Set-Cookie",
    serializeCookie(options.cookieName ?? config.authCsrfCookieName, "", {
      httpOnly: false,
      maxAge: 0,
      path: "/",
      sameSite: "Lax",
      secure: options.secure ?? config.appEnv === "production",
    }),
  );
}

function isSessionPayload(value: unknown): value is SessionTokenPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    record.version === AUTH_TOKEN_VERSION &&
    typeof record.sub === "string" &&
    typeof record.username === "string" &&
    typeof record.email === "string" &&
    isUserRole(record.role) &&
    typeof record.sessionVersion === "number" &&
    typeof record.iat === "number" &&
    typeof record.exp === "number"
  );
}

async function hmacSha256(input: string, secret: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(input)));
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "=",
  );
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

function parseCookies(header: string | null): Map<string, string> {
  const cookies = new Map<string, string>();
  if (!header) {
    return cookies;
  }
  for (const entry of header.split(";")) {
    const [name, ...valueParts] = entry.trim().split("=");
    if (name) {
      cookies.set(name, decodeURIComponent(valueParts.join("=")));
    }
  }
  return cookies;
}

function serializeCookie(
  name: string,
  value: string,
  options: {
    httpOnly: boolean;
    maxAge: number;
    path: string;
    sameSite: "Lax";
    secure: boolean;
  },
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Max-Age=${options.maxAge}`,
    `Path=${options.path}`,
    `SameSite=${options.sameSite}`,
  ];
  if (options.httpOnly) {
    parts.push("HttpOnly");
  }
  if (options.secure) {
    parts.push("Secure");
  }
  return parts.join("; ");
}
