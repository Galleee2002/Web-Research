import { beforeEach, describe, expect, it, vi } from "vitest";

const existsSyncMock = vi.fn();
const readFileSyncMock = vi.fn();
const spawnMock = vi.fn();

vi.mock("node:fs", () => ({
  existsSync: existsSyncMock,
  readFileSync: readFileSyncMock
}));

vi.mock("node:child_process", () => ({
  spawn: spawnMock
}));

vi.mock("@/lib/api/logger", () => ({
  logError: vi.fn(),
  logInfo: vi.fn()
}));

function mockWorkerLayout() {
  existsSyncMock.mockImplementation((path: string) => {
    const normalized = path.replace(/\\/g, "/");
    return normalized.endsWith("/services/workers/src");
  });
  readFileSyncMock.mockReturnValue("");
}

describe("worker trigger", () => {
  beforeEach(() => {
    vi.resetModules();
    existsSyncMock.mockReset();
    readFileSyncMock.mockReset();
    spawnMock.mockReset();
    process.env.DATABASE_URL = "postgresql://example";
    process.env.GOOGLE_PLACES_API_KEY = "test-key";
  });

  it("buildWorkerEnv prefers runtime values over file values", async () => {
    existsSyncMock.mockReturnValue(true);
    readFileSyncMock.mockReturnValue('DATABASE_URL="postgresql://from-file"\n');

    const { buildWorkerEnv } = await import("./worker-trigger");
    const env = buildWorkerEnv("/repo", {
      ...process.env,
      DATABASE_URL: "postgresql://runtime",
      GOOGLE_PLACES_API_KEY: "runtime-key"
    });

    expect(env.DATABASE_URL).toBe("postgresql://runtime");
    expect(env.GOOGLE_PLACES_API_KEY).toBe("runtime-key");
  });

  it("returns missing_database_url when env is incomplete", async () => {
    mockWorkerLayout();
    delete process.env.DATABASE_URL;

    const { triggerWorkerRunInBackground } = await import("./worker-trigger");
    const result = triggerWorkerRunInBackground();

    expect(result).toEqual({ started: false, reason: "missing_database_url" });
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("spawns the worker with shell enabled on Windows", async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, "platform", { value: "win32" });
    mockWorkerLayout();
    spawnMock.mockReturnValue({
      on: vi.fn(),
      pid: 1234
    });

    const { triggerWorkerRunInBackground } = await import("./worker-trigger");
    const result = triggerWorkerRunInBackground();

    expect(result).toEqual({ started: true });
    expect(spawnMock).toHaveBeenCalledWith(
      "py",
      ["-m", "workers"],
      expect.objectContaining({
        shell: true,
        detached: false
      })
    );

    Object.defineProperty(process, "platform", { value: originalPlatform });
  });
});
