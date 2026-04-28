import {
  isLeadStatus,
  isOpportunityRating,
  type LeadStatus,
} from "../constants/domain";
import { INPUT_LIMITS } from "../constants/pagination";
import type {
  OpportunityFilters,
  OpportunityRatingUpdate,
  OpportunitySelectionUpdate,
  OpportunityUpdate,
} from "../types/opportunity";
import {
  isRecord,
  parseOptionalString,
  parsePaginationParams,
  type ValidationResult,
} from "./pagination";

const ORDER_BY_FIELDS = ["rating", "created_at", "name", "city"] as const;

export function parseOpportunityRatingUpdate(
  input: unknown,
): ValidationResult<OpportunityRatingUpdate> {
  if (!isRecord(input)) {
    return { ok: false, errors: ["payload must be an object"] };
  }

  if (!Object.hasOwn(input, "rating")) {
    return { ok: false, errors: ["rating is required"] };
  }

  if (input.rating === null) {
    return { ok: true, value: { rating: null } };
  }

  if (!isOpportunityRating(input.rating)) {
    return { ok: false, errors: ["rating must be an integer from 1 to 5 or null"] };
  }

  return { ok: true, value: { rating: input.rating } };
}

export function parseOpportunityUpdate(
  input: unknown,
): ValidationResult<OpportunityUpdate> {
  if (!isRecord(input)) {
    return { ok: false, errors: ["payload must be an object"] };
  }

  const hasRating = Object.hasOwn(input, "rating");
  const hasStatus = Object.hasOwn(input, "status");
  const hasNotes = Object.hasOwn(input, "notes");

  if (!hasRating && !hasStatus && !hasNotes) {
    return { ok: false, errors: ["at least one of rating, status, or notes is required"] };
  }

  const errors: string[] = [];
  const next: OpportunityUpdate = {};

  if (hasRating) {
    if (input.rating === null) {
      next.rating = null;
    } else if (isOpportunityRating(input.rating)) {
      next.rating = input.rating;
    } else {
      errors.push("rating must be an integer from 1 to 5 or null");
    }
  }

  if (hasStatus) {
    if (isLeadStatus(input.status)) {
      next.status = input.status;
    } else {
      errors.push("status is not a valid lead status");
    }
  }

  if (hasNotes) {
    if (input.notes === null) {
      next.notes = null;
    } else {
      const parsedNotes = parseOptionalString(
        input.notes,
        "notes",
        INPUT_LIMITS.notes,
        errors,
      );
      if (parsedNotes !== undefined) {
        next.notes = parsedNotes;
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: next };
}

export function parseOpportunitySelectionUpdate(
  input: unknown,
): ValidationResult<OpportunitySelectionUpdate> {
  if (!isRecord(input)) {
    return { ok: false, errors: ["payload must be an object"] };
  }

  if (!Object.hasOwn(input, "is_selected")) {
    return { ok: false, errors: ["is_selected is required"] };
  }

  if (typeof input.is_selected !== "boolean") {
    return { ok: false, errors: ["is_selected must be true or false"] };
  }

  return {
    ok: true,
    value: {
      is_selected: input.is_selected,
    },
  };
}

export function parseOpportunityFilters(
  input: unknown,
): ValidationResult<OpportunityFilters> {
  const record = isRecord(input) ? input : {};
  const errors: string[] = [];
  const pagination = parsePaginationParams(record);

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

  const orderByValue = record.order_by ?? "rating";
  let orderBy: OpportunityFilters["order_by"] = "rating";
  if (
    typeof orderByValue !== "string" ||
    !ORDER_BY_FIELDS.includes(orderByValue as NonNullable<OpportunityFilters["order_by"]>)
  ) {
    errors.push("order_by must be rating, created_at, name, or city");
  } else {
    orderBy = orderByValue as OpportunityFilters["order_by"];
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      ...pagination,
      ...(parsedStatus === undefined ? {} : { status: parsedStatus }),
      ...(city === undefined ? {} : { city }),
      ...(category === undefined ? {} : { category }),
      ...(query === undefined ? {} : { query }),
      order_by: orderBy,
    },
  };
}
