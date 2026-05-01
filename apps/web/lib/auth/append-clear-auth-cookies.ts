import { getRuntimeConfig } from "@/lib/config/runtime";

/** Clears httpOnly session and client CSRF cookies so stale JWTs stop gating middleware. */
export function appendClearAuthCookies(response: Response): void {
  const config = getRuntimeConfig();
  const secure = config.appEnv === "production";
  response.headers.append(
    "Set-Cookie",
    buildExpiredCookie(config.authCookieName, { httpOnly: true, secure }),
  );
  response.headers.append(
    "Set-Cookie",
    buildExpiredCookie(config.authCsrfCookieName, { httpOnly: false, secure }),
  );
}

function buildExpiredCookie(
  name: string,
  options: { httpOnly: boolean; secure: boolean },
): string {
  const parts = [`${name}=`, "Max-Age=0", "Path=/", "SameSite=Lax"];
  if (options.httpOnly) {
    parts.push("HttpOnly");
  }
  if (options.secure) {
    parts.push("Secure");
  }
  return parts.join("; ");
}
