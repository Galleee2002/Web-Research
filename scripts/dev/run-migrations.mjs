import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, basename } from "node:path";
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

const databaseUrl = envFromFiles.DATABASE_URL;
if (!databaseUrl) {
  console.error("error: DATABASE_URL is required to run migrations.");
  process.exit(1);
}

const useSsl =
  databaseUrl.includes("sslmode=require") ||
  databaseUrl.includes("neon.tech") ||
  databaseUrl.includes("supabase.co");

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ...(useSsl ? { ssl: { rejectUnauthorized: true } } : {})
});

const migrationsDir = resolve(rootDir, "database", "migrations");
const migrationFiles = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

let failed = false;

for (const fileName of migrationFiles) {
  const filePath = resolve(migrationsDir, fileName);
  const sql = readFileSync(filePath, "utf8");
  process.stdout.write(`Applying ${fileName}... `);
  try {
    await pool.query(sql);
    console.log("ok");
  } catch (error) {
    failed = true;
    const message = error instanceof Error ? error.message : String(error);
    console.log("failed");
    console.error(message);
  }
}

await pool.end();
process.exit(failed ? 1 : 0);
