import { existsSync, readFileSync } from "node:fs";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { resolve } from "node:path";
import pg from "pg";

const scrypt = promisify(scryptCallback);
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
  ...readEnvFile(resolve(rootDir, ".env.local")),
};

for (const [key, value] of Object.entries(envFromFiles)) {
  process.env[key] = value;
}

const required = [
  "DATABASE_URL",
  "ADMIN_USERNAME",
  "ADMIN_EMAIL",
  "ADMIN_FIRST_NAME",
  "ADMIN_LAST_NAME",
  "ADMIN_PASSWORD",
];
for (const key of required) {
  if (!process.env[key]?.trim()) {
    console.error(`error: ${key} is required.`);
    process.exit(1);
  }
}

if (process.env.ADMIN_PASSWORD.length < 12) {
  console.error("error: ADMIN_PASSWORD must be at least 12 characters.");
  process.exit(1);
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const derived = await scrypt(password, salt, 64);
  return `scrypt$16384$8$1$${salt}$${Buffer.from(derived).toString("base64url")}`;
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  const passwordHash = await hashPassword(process.env.ADMIN_PASSWORD);
  const result = await client.query(
    `
      with existing as (
        select id
        from users
        where lower(email) = lower($2) or lower(username) = lower($1)
        order by created_at asc
        limit 1
      ),
      updated as (
        update users
        set
          username = $1,
          email = $2,
          first_name = $3,
          last_name = $4,
          phone = $5,
          password_hash = $6,
          role = 'admin',
          updated_at = now()
        where id in (select id from existing)
        returning id, email, role
      ),
      inserted as (
        insert into users (
          username,
          email,
          first_name,
          last_name,
          phone,
          password_hash,
          role
        )
        select $1, $2, $3, $4, $5, $6, 'admin'
        where not exists (select 1 from existing)
        returning id, email, role
      )
      select id, email, role from updated
      union all
      select id, email, role from inserted
      limit 1
    `,
    [
      process.env.ADMIN_USERNAME.trim().toLowerCase(),
      process.env.ADMIN_EMAIL.trim().toLowerCase(),
      process.env.ADMIN_FIRST_NAME.trim(),
      process.env.ADMIN_LAST_NAME.trim(),
      process.env.ADMIN_PHONE?.trim() || null,
      passwordHash,
    ],
  );

  const user = result.rows[0];
  console.log(`Admin user ready: ${user.email} (${user.role}) id=${user.id}`);
} finally {
  await client.end();
}
