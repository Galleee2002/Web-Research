import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const rootDir = resolve(import.meta.dirname, "..", "..");

function parseEnvFile(content) {
  const parsed = {};
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

function readEnvFile(path) {
  if (!existsSync(path)) {
    return {};
  }
  return parseEnvFile(readFileSync(path, "utf8"));
}

const envFromFiles = {
  ...readEnvFile(resolve(rootDir, ".env")),
  ...readEnvFile(resolve(rootDir, ".env.local"))
};

for (const [key, value] of Object.entries(envFromFiles)) {
  process.env[key] = value;
}

if (!process.env.DATABASE_URL) {
  console.warn("warning: DATABASE_URL is not set; database-backed API routes may fail.");
}

const npmCommand = "npm";
const child = spawn(npmCommand, ["--workspace", "apps/web", "run", "dev"], {
  cwd: rootDir,
  shell: process.platform === "win32",
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
