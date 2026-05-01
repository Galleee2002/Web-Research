import { NextResponse, type NextRequest } from "next/server";
import { getRuntimeConfig } from "@/lib/config/runtime";

const AUTH_TOKEN_VERSION = 1;
const PUBLIC_ROUTES = new Set(["/login", "/register"]);
const PUBLIC_API_PREFIXES = ["/api/auth", "/api/health"];
const PROTECTED_PAGE_PREFIXES = [
  "/dashboard",
  "/businesses",
  "/opportunities",
  "/scans",
  "/analytics",
  "/settings",
  "/profile",
  "/admin",
];

type MiddlewareSession = {
  version: number;
  sub: string;
  username: string;
  email: string;
  role: "admin" | "user";
  iat: number;
  exp: number;
};

const encoder = new TextEncoder();

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await getSession(request);

  if (pathname === "/") {
    if (session) {
      return withSecurityHeaders(NextResponse.redirect(new URL("/dashboard", request.url)));
    }
    return withSecurityHeaders(NextResponse.redirect(new URL("/login", request.url)));
  }

  if (PUBLIC_ROUTES.has(pathname)) {
    if (session) {
      return withSecurityHeaders(NextResponse.redirect(new URL("/dashboard", request.url)));
    }
    return withSecurityHeaders(NextResponse.next());
  }

  if (pathname.startsWith("/api/")) {
    if (PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      return withSecurityHeaders(NextResponse.next());
    }
    if (!session) {
      return withSecurityHeaders(apiError("unauthorized", "Authentication is required", 401));
    }
    if (pathname.startsWith("/api/admin") && session.role !== "admin") {
      return withSecurityHeaders(apiError("forbidden", "Insufficient permissions", 403));
    }
    return withSecurityHeaders(NextResponse.next());
  }

  if (isProtectedPage(pathname) && !session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return withSecurityHeaders(NextResponse.redirect(loginUrl));
  }

  if (pathname.startsWith("/admin") && session?.role !== "admin") {
    return withSecurityHeaders(NextResponse.redirect(new URL("/dashboard", request.url)));
  }

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)",
  ],
};

function isProtectedPage(pathname: string): boolean {
  return PROTECTED_PAGE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function apiError(code: "forbidden" | "unauthorized", message: string, status: number) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        correlation_id: crypto.randomUUID(),
      },
    },
    { status },
  );
}

async function getSession(request: NextRequest): Promise<MiddlewareSession | null> {
  const config = getRuntimeConfig();
  const token = request.cookies.get(config.authCookieName)?.value;
  if (!token) {
    return null;
  }
  return verifyToken(token, config.authJwtSecret);
}

async function verifyToken(token: string, secret: string): Promise<MiddlewareSession | null> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expected = await hmacSha256(signingInput, secret);
  const actual = base64UrlDecode(encodedSignature);
  if (!constantTimeEqual(expected, actual)) {
    return null;
  }

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedPayload)));
    const now = Math.floor(Date.now() / 1000);
    if (!isMiddlewareSession(payload) || payload.exp <= now) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function isMiddlewareSession(value: unknown): value is MiddlewareSession {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    record.version === AUTH_TOKEN_VERSION &&
    typeof record.sub === "string" &&
    typeof record.username === "string" &&
    typeof record.email === "string" &&
    (record.role === "admin" || record.role === "user") &&
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

function withSecurityHeaders(response: NextResponse): NextResponse {
  const { appEnv } = getRuntimeConfig();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Content-Security-Policy", "frame-ancestors 'none'");
  if (appEnv === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }
  return response;
}
