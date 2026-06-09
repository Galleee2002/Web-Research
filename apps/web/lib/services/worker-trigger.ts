import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { logError, logInfo } from "@/lib/api/logger";

export type WorkerTriggerReason =
  | "worker_directory_not_found"
  | "missing_database_url"
  | "missing_google_places_api_key"
  | "python_runtime_not_found";

export type WorkerTriggerResult = {
  started: boolean;
  reason?: WorkerTriggerReason;
};

const WORKER_ENV_KEYS = [
  "APP_ENV",
  "DATABASE_URL",
  "GOOGLE_PLACES_API_KEY",
  "GOOGLE_GEOCODING_API_KEY",
  "GOOGLE_REQUEST_TIMEOUT_SECONDS",
  "GOOGLE_DAILY_REQUEST_LIMIT",
  "GOOGLE_QUOTA_STATE_PATH",
  "DEFAULT_PAGE_SIZE",
  "MAX_PAGE_SIZE",
  "LOG_LEVEL"
] as const;

function parseEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) {
    return {};
  }

  const parsed: Record<string, string> = {};
  const content = readFileSync(path, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");
    if (equalsIndex <= 0) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
}

export function resolveRepoRoot(): string | null {
  const candidates = [
    process.cwd(),
    resolve(process.cwd(), ".."),
    resolve(process.cwd(), "..", "..")
  ];

  for (const candidate of candidates) {
    if (existsSync(resolve(candidate, "services", "workers", "src"))) {
      return candidate;
    }
  }

  return null;
}

function resolveWorkerCwd(repoRoot: string): string | null {
  const candidate = resolve(repoRoot, "services", "workers", "src");
  return existsSync(candidate) ? candidate : null;
}

export function buildWorkerEnv(
  repoRoot: string,
  runtimeEnv: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
  const fileEnv = {
    ...parseEnvFile(resolve(repoRoot, ".env")),
    ...parseEnvFile(resolve(repoRoot, ".env.local")),
    ...parseEnvFile(resolve(repoRoot, "apps", "web", ".env.local"))
  };

  const merged: NodeJS.ProcessEnv = { ...runtimeEnv };

  for (const key of WORKER_ENV_KEYS) {
    const runtimeValue = runtimeEnv[key]?.trim();
    const fileValue = fileEnv[key]?.trim();
    if (runtimeValue) {
      merged[key] = runtimeValue;
      continue;
    }
    if (fileValue) {
      merged[key] = fileValue;
    }
  }

  return merged;
}

function validateWorkerEnv(env: NodeJS.ProcessEnv): WorkerTriggerReason | null {
  if (!env.DATABASE_URL?.trim()) {
    return "missing_database_url";
  }
  if (!env.GOOGLE_PLACES_API_KEY?.trim()) {
    return "missing_google_places_api_key";
  }
  return null;
}

function resolvePythonCommand(): string {
  return process.platform === "win32" ? "py" : "python3";
}

export function triggerWorkerRunInBackground(): WorkerTriggerResult {
  const repoRoot = resolveRepoRoot();
  if (!repoRoot) {
    logError("worker_trigger_failed", {
      error_stage: "worker",
      error_code: "worker_directory_not_found"
    });
    return { started: false, reason: "worker_directory_not_found" };
  }

  const workerCwd = resolveWorkerCwd(repoRoot);
  if (!workerCwd) {
    logError("worker_trigger_failed", {
      error_stage: "worker",
      error_code: "worker_directory_not_found"
    });
    return { started: false, reason: "worker_directory_not_found" };
  }

  const env = buildWorkerEnv(repoRoot);
  const validationReason = validateWorkerEnv(env);
  if (validationReason) {
    logError("worker_trigger_failed", {
      error_stage: "worker",
      error_code: validationReason
    });
    return { started: false, reason: validationReason };
  }

  const command = resolvePythonCommand();
  const isWindows = process.platform === "win32";
  const child = spawn(command, ["-m", "workers"], {
    cwd: workerCwd,
    env,
    stdio: "ignore",
    windowsHide: true,
    shell: isWindows,
    detached: !isWindows
  });

  child.on("error", (error) => {
    logError("worker_spawn_failed", {
      error_stage: "worker",
      error_code: "spawn_error",
      error_message: error.message,
      provider: "google_places"
    });
  });

  if (!isWindows) {
    child.unref();
  }

  logInfo("worker_trigger_started", {
    error_stage: "worker",
    provider: "google_places",
    result_count: child.pid ?? null
  });

  return { started: true };
}
