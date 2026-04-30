import { describe, expect, it, vi } from "vitest";

import { withApiRoute } from "./http";

let mockAppEnv: "development" | "production" | "test" = "development";

vi.mock("@/lib/config/runtime", () => ({
  getRuntimeConfig: () => ({
    appEnv: mockAppEnv,
    allowedOrigins: ["https://app.example.com"],
    apiJsonBodyLimitBytes: 16,
    authCookieName: "blf_session",
    authCsrfCookieName: "blf_csrf",
  })
}));

describe("withApiRoute", () => {
  it("rejects malformed inbound correlation ids without echoing them", async () => {
    const response = await withApiRoute(
      new Request("http://localhost/api/test", {
        method: "GET",
        headers: {
          "X-Correlation-Id": "bad value with spaces"
        }
      }),
      { route: "/api/test" },
      async () => Response.json({ ok: true })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("validation_error");
    expect(body.error.details).toContain("X-Correlation-Id is invalid");
    expect(body.error.correlation_id).not.toBe("bad value with spaces");
  });

  it("rejects oversized json bodies before route handlers parse them", async () => {
    const handler = vi.fn(async () => Response.json({ ok: true }));
    const response = await withApiRoute(
      new Request("http://localhost/api/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": "17"
        },
        body: JSON.stringify({ name: "demo" })
      }),
      { route: "/api/test" },
      handler
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("validation_error");
    expect(body.error.details).toContain("request body is too large");
    expect(handler).not.toHaveBeenCalled();
  });

  it("adds CORS headers only for configured allowed origins", async () => {
    const allowed = await withApiRoute(
      new Request("http://localhost/api/test", {
        headers: { Origin: "https://app.example.com" }
      }),
      { route: "/api/test" },
      async () => Response.json({ ok: true })
    );
    const denied = await withApiRoute(
      new Request("http://localhost/api/test", {
        headers: { Origin: "https://evil.example.com" }
      }),
      { route: "/api/test" },
      async () => Response.json({ ok: true })
    );

    expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://app.example.com"
    );
    expect(denied.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("rejects mutating authenticated requests without matching csrf header", async () => {
    const response = await withApiRoute(
      new Request("http://localhost/api/protected", {
        method: "PATCH",
        headers: {
          Cookie: "blf_session=token; blf_csrf=csrf-value",
        },
      }),
      { route: "/api/protected" },
      async () => Response.json({ ok: true }),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("forbidden");
    expect(body.error.message).toContain("CSRF");
  });

  it("rejects production mutating requests with auth cookie when origin is missing", async () => {
    mockAppEnv = "production";
    const response = await withApiRoute(
      new Request("http://localhost/api/protected", {
        method: "POST",
        headers: {
          Cookie: "blf_session=token; blf_csrf=csrf-value",
          "X-CSRF-Token": "csrf-value",
        },
      }),
      { route: "/api/protected" },
      async () => Response.json({ ok: true }),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.message).toContain("Origin");
    mockAppEnv = "development";
  });

  it("rejects production mutating requests with disallowed origin", async () => {
    mockAppEnv = "production";
    const response = await withApiRoute(
      new Request("http://localhost/api/protected", {
        method: "PATCH",
        headers: {
          Origin: "https://evil.example.com",
          Cookie: "blf_session=token; blf_csrf=csrf-value",
          "X-CSRF-Token": "csrf-value",
        },
      }),
      { route: "/api/protected" },
      async () => Response.json({ ok: true }),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.message).toContain("not allowed");
    mockAppEnv = "development";
  });

  it("accepts production mutating requests with allowed origin", async () => {
    mockAppEnv = "production";
    const response = await withApiRoute(
      new Request("http://localhost/api/protected", {
        method: "PATCH",
        headers: {
          Origin: "https://app.example.com",
          Cookie: "blf_session=token; blf_csrf=csrf-value",
          "X-CSRF-Token": "csrf-value",
        },
      }),
      { route: "/api/protected" },
      async () => Response.json({ ok: true }),
    );

    expect(response.status).toBe(200);
    mockAppEnv = "development";
  });

  it("allows missing origin in development", async () => {
    mockAppEnv = "development";
    const response = await withApiRoute(
      new Request("http://localhost/api/protected", {
        method: "PATCH",
        headers: {
          Cookie: "blf_session=token; blf_csrf=csrf-value",
          "X-CSRF-Token": "csrf-value",
        },
      }),
      { route: "/api/protected" },
      async () => Response.json({ ok: true }),
    );

    expect(response.status).toBe(200);
  });
});
