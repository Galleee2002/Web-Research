type LogPrimitive = boolean | number | string | null;

export type LogFields = Record<string, LogPrimitive | undefined>;

function normalizeFields(fields: LogFields): Record<string, LogPrimitive> {
  const normalized: Record<string, LogPrimitive> = {};

  for (const [key, value] of Object.entries(fields)) {
    normalized[key] = value ?? null;
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
