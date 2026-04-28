import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

function resolveWorkerCwd(): string | null {
  const candidates = [
    resolve(process.cwd(), "services", "workers", "src"),
    resolve(process.cwd(), "..", "..", "services", "workers", "src")
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function triggerWorkerRunInBackground(): {
  started: boolean;
  reason?: string;
} {
  const workerCwd = resolveWorkerCwd();
  if (!workerCwd) {
    return { started: false, reason: "worker_directory_not_found" };
  }

  const command = process.platform === "win32" ? "py" : "python3";
  const child = spawn(command, ["-m", "workers"], {
    cwd: workerCwd,
    detached: true,
    stdio: "ignore",
    env: process.env
  });

  child.on("error", () => {
    void 0;
  });
  child.unref();

  return { started: true };
}
