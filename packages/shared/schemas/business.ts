import { isLeadStatus } from "../constants/domain";
import { INPUT_LIMITS } from "../constants/pagination";
import type { LeadStatus } from "../constants/domain";
import type { BusinessFilters, BusinessStatusUpdate } from "../types/business";
import {
  isRecord,
  parseOptionalString,
  parseStrictPaginationParams,
  type ValidationResult,
} from "./pagination";

const ORDER_BY_FIELDS = ["created_at", "name", "city"] as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseOptionalSearchRunId(
  record: Record<string, unknown>,
  errors: string[],
): string | undefined {
  const raw = record.search_run_id;
  if (raw === undefined) {
    return undefined;
  }
  if (typeof raw !== "string") {
    errors.push("search_run_id must be a string");
    return undefined;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  if (!UUID_RE.test(trimmed)) {
    errors.push("search_run_id must be a valid UUID");
    return undefined;
  }
  return trimmed;
}

function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return undefined;
}

export function parseBusinessStatusUpdate(
  input: unknown,
): ValidationResult<BusinessStatusUpdate> {
  if (!isRecord(input)) {
    return { ok: false, errors: ["payload must be an object"] };
  }

  const errors: string[] = [];

  if (!isLeadStatus(input.status)) {
    errors.push("status is not a valid lead status");
  }

  let notes: string | null | undefined;
  if (input.notes === null) {
    notes = null;
  } else if (input.notes !== undefined) {
    notes = parseOptionalString(input.notes, "notes", INPUT_LIMITS.notes, errors);
  }

  if (errors.length > 0 || !isLeadStatus(input.status)) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      status: input.status,
      ...(input.notes === undefined ? {} : { notes }),
    },
  };
}

export function parseBusinessFilters(input: unknown): ValidationResult<BusinessFilters> {
  const record = isRecord(input) ? input : {};
  const errors: string[] = [];
  const pagination = parseStrictPaginationParams(record, errors);

  const hasWebsite = parseBoolean(record.has_website);
  if (record.has_website !== undefined && hasWebsite === undefined) {
    errors.push("has_website must be true or false");
  }

  const status = record.status;
  let parsedStatus: LeadStatus | undefined;
  if (status !== undefined && !isLeadStatus(status)) {
    errors.push("status is not a valid lead status");
  } else if (status !== undefined) {
    parsedStatus = status;
  }

  const city = parseOptionalString(
    record.city,
    "city",
    INPUT_LIMITS.city,
    errors,
  );
  const category = parseOptionalString(
    record.category,
    "category",
    INPUT_LIMITS.category,
    errors,
  );
  const query = parseOptionalString(
    record.query,
    "query",
    INPUT_LIMITS.textSearch,
    errors,
  );

  const orderByValue = record.order_by ?? "created_at";
  let orderBy: BusinessFilters["order_by"] = "created_at";
  if (
    typeof orderByValue !== "string" ||
    !ORDER_BY_FIELDS.includes(orderByValue as NonNullable<BusinessFilters["order_by"]>)
  ) {
    errors.push("order_by must be created_at, name, or city");
  } else {
    orderBy = orderByValue as BusinessFilters["order_by"];
  }

  const searchRunId = parseOptionalSearchRunId(record, errors);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      ...pagination,
      ...(hasWebsite === undefined ? {} : { has_website: hasWebsite }),
      ...(parsedStatus === undefined ? {} : { status: parsedStatus }),
      ...(city === undefined ? {} : { city }),
      ...(category === undefined ? {} : { category }),
      ...(query === undefined ? {} : { query }),
      ...(searchRunId === undefined ? {} : { search_run_id: searchRunId }),
      order_by: orderBy,
    },
  };
}
