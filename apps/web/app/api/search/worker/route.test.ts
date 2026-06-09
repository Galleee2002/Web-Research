import { beforeEach, describe, expect, it, vi } from "vitest";

const triggerWorkerRunInBackgroundMock = vi.fn();

vi.mock("@/lib/services/worker-trigger", () => ({
  triggerWorkerRunInBackground: triggerWorkerRunInBackgroundMock
}));

describe("POST /api/search/worker", () => {
  beforeEach(() => {
    triggerWorkerRunInBackgroundMock.mockReset();
  });

  it("starts the worker when trigger succeeds", async () => {
    triggerWorkerRunInBackgroundMock.mockReturnValue({ started: true });

    const response = await import("./route").then(({ POST }) =>
      POST(new Request("http://localhost/api/search/worker", { method: "POST" }))
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ started: true });
  });

  it("returns 503 when the worker cannot start", async () => {
    triggerWorkerRunInBackgroundMock.mockReturnValue({
      started: false,
      reason: "missing_database_url"
    });

    const response = await import("./route").then(({ POST }) =>
      POST(new Request("http://localhost/api/search/worker", { method: "POST" }))
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error.code).toBe("internal_error");
    expect(body.error.message).toContain("DATABASE_URL");
  });
});
