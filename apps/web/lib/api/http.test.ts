import { describe, expect, it, vi } from "vitest";

import { withApiRoute } from "./http";

vi.mock("@/lib/config/runtime", () => ({
  getRuntimeConfig: () => ({
    allowedOrigins: ["https://app.example.com"],
    apiJsonBodyLimitBytes: 16
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
});
