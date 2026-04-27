type LogPrimitive = boolean | number | string | null;

export type LogFields = Record<string, LogPrimitive | undefined>;

const SENSITIVE_ASSIGNMENT_PATTERN =
  /\b((?:GOOGLE_[A-Z_]*API_KEY|DATABASE_URL|API_KEY|TOKEN|SECRET|PASSWORD)=)([^&\s]+)/gi;
const DATABASE_URL_PATTERN = /\bpostgres(?:ql)?:\/\/[^\s"']+/gi;
const URL_KEY_PATTERN = /([?&]key=)[^&\s"']+/gi;

export function redactSensitiveText(value: string): string {
  return value
    .replace(DATABASE_URL_PATTERN, "[REDACTED_DATABASE_URL]")
    .replace(SENSITIVE_ASSIGNMENT_PATTERN, "$1[REDACTED]")
    .replace(URL_KEY_PATTERN, "$1[REDACTED]");
}

function normalizeFields(fields: LogFields): Record<string, LogPrimitive> {
  const normalized: Record<string, LogPrimitive> = {};

  for (const [key, value] of Object.entries(fields)) {
    normalized[key] = typeof value === "string" ? redactSensitiveText(value) : value ?? null;
  }

  return normalized;
}

function writeLog(level: "error" | "info", event: string, fields: LogFields = {}): void {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...normalizeFields(fields)
  };
  const serialized = JSON.stringify(payload);

  if (level === "error") {
    console.error(serialized);
    return;
  }

  console.log(serialized);
}

export function logInfo(event: string, fields: LogFields = {}): void {
  writeLog("info", event, fields);
}

export function logError(event: string, fields: LogFields = {}): void {
  writeLog("error", event, fields);
}
