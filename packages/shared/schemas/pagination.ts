import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../constants/pagination";

export interface PaginationParams {
  page: number;
  page_size: number;
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

export function getRecordValue(
  input: Record<string, unknown>,
  key: string,
): unknown {
  return input[key];
}

export function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

export function trimOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function parseRequiredString(
  input: Record<string, unknown>,
  key: string,
  maxLength: number,
  errors: string[],
): string | undefined {
  const value = getRecordValue(input, key);

  if (typeof value !== "string") {
    errors.push(`${key} must be a string`);
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    errors.push(`${key} is required`);
    return undefined;
  }

  if (trimmed.length > maxLength) {
    errors.push(`${key} must be ${maxLength} characters or fewer`);
    return undefined;
  }

  return trimmed;
}

export function parseOptionalString(
  value: unknown,
  key: string,
  maxLength: number,
  errors: string[],
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    errors.push(`${key} must be a string`);
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  if (trimmed.length > maxLength) {
    errors.push(`${key} must be ${maxLength} characters or fewer`);
    return undefined;
  }

  return trimmed;
}

function toPositiveInteger(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value > 0 ? value : fallback;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }

  return fallback;
}

export function parsePaginationParams(input: unknown): PaginationParams {
  const record = isRecord(input) ? input : {};
  const page = toPositiveInteger(record.page, DEFAULT_PAGE);
  const requestedPageSize = toPositiveInteger(record.page_size, DEFAULT_PAGE_SIZE);

  return {
    page,
    page_size: Math.min(requestedPageSize, MAX_PAGE_SIZE),
  };
}

export function parseStrictPaginationParams(
  input: unknown,
  errors: string[],
): PaginationParams {
  const record = isRecord(input) ? input : {};

  return {
    page: parsePositiveInteger(record.page, "page", DEFAULT_PAGE, errors),
    page_size: Math.min(
      parsePositiveInteger(
        record.page_size,
        "page_size",
        DEFAULT_PAGE_SIZE,
        errors,
      ),
      MAX_PAGE_SIZE,
    ),
  };
}

function parsePositiveInteger(
  value: unknown,
  key: string,
  fallback: number,
  errors: string[],
): number {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    errors.push(`${key} must be a positive integer`);
    return fallback;
  }

  return parsed;
}
