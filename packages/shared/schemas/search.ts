import {
  DEFAULT_BUSINESS_SOURCE,
  isBusinessSource,
  isSearchRunStatus,
} from "../constants/domain";
import { INPUT_LIMITS } from "../constants/pagination";
import type { BusinessSource, SearchRunStatus } from "../constants/domain";
import type { SearchCreate, SearchFilters } from "../types/search";
import {
  isRecord,
  parsePaginationParams,
  parseRequiredString,
  type ValidationResult,
} from "./pagination";

export function parseSearchCreate(input: unknown): ValidationResult<SearchCreate> {
  if (!isRecord(input)) {
    return { ok: false, errors: ["payload must be an object"] };
  }

  const errors: string[] = [];
  const query = parseRequiredString(input, "query", INPUT_LIMITS.query, errors);
  const location = parseRequiredString(
    input,
    "location",
    INPUT_LIMITS.location,
    errors,
  );

  if (errors.length > 0 || query === undefined || location === undefined) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: { query, location },
  };
}

export function parseSearchFilters(input: unknown): ValidationResult<SearchFilters> {
  const record = isRecord(input) ? input : {};
  const errors: string[] = [];
  const pagination = parsePaginationParams(record);

  const status = record.status;
  let parsedStatus: SearchRunStatus | undefined;
  if (status !== undefined && !isSearchRunStatus(status)) {
    errors.push("status is not a valid search run status");
  } else if (status !== undefined) {
    parsedStatus = status;
  }

  const source = record.source ?? DEFAULT_BUSINESS_SOURCE;
  let parsedSource: BusinessSource = DEFAULT_BUSINESS_SOURCE;
  if (!isBusinessSource(source)) {
    errors.push("source is not a valid business source");
  } else {
    parsedSource = source;
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      ...pagination,
      ...(parsedStatus === undefined ? {} : { status: parsedStatus }),
      source: parsedSource,
    },
  };
}
