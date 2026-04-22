import { isLeadStatus } from "../constants/domain";
import { INPUT_LIMITS } from "../constants/pagination";
import type { LeadStatus } from "../constants/domain";
import type { BusinessFilters, BusinessStatusUpdate } from "../types/business";
import {
  isRecord,
  parseOptionalString,
  parsePaginationParams,
  type ValidationResult,
} from "./pagination";

const ORDER_BY_FIELDS = ["created_at", "name", "city"] as const;

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
  const pagination = parsePaginationParams(record);

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
      order_by: orderBy,
    },
  };
}
