import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

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

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("error: DATABASE_URL is required to run migrations.");
  process.exit(1);
}

const migrationsDir = resolve(rootDir, "database", "migrations");
const files = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();

try {
  for (const name of files) {
    const path = resolve(migrationsDir, name);
    const sql = readFileSync(path, "utf8");
    console.log(`Applying ${name}`);
    await client.query(sql);
  }
} finally {
  await client.end();
}

console.log("Migrations finished.");
