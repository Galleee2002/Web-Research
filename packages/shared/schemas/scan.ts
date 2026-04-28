import { isSearchRunStatus } from "../constants/domain";
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../constants/pagination";
import type { SearchRunStatus } from "../constants/domain";
import type { ScanFilters, ScanStartedAtOrder } from "../types/scan";
import {
  isRecord,
  parseOptionalString,
  parseStrictPaginationParams,
  type ValidationResult,
} from "./pagination";

export function parseScanFilters(input: unknown): ValidationResult<ScanFilters> {
  const record = isRecord(input) ? input : {};
  const errors: string[] = [];
  const pagination = parseStrictPaginationParams(record, errors);

  const provider = parseOptionalString(
    record.provider as unknown,
    "provider",
    255,
    errors
  );

  let status: SearchRunStatus | undefined;
  if (record.status !== undefined && !isSearchRunStatus(record.status)) {
    errors.push("status is not a valid search run status");
  } else if (record.status !== undefined) {
    status = record.status as SearchRunStatus;
  }

  const from = parseOptionalString(
    record.from as unknown,
    "from",
    255,
    errors
  );
  const to = parseOptionalString(
    record.to as unknown,
    "to",
    255,
    errors
  );

  const startedAtOrderRaw = record.started_at_order;
  let startedAtOrder: ScanStartedAtOrder | undefined;
  if (startedAtOrderRaw !== undefined && startedAtOrderRaw !== null && startedAtOrderRaw !== "") {
    if (startedAtOrderRaw !== "asc" && startedAtOrderRaw !== "desc") {
      errors.push("started_at_order must be asc or desc");
    } else {
      startedAtOrder = startedAtOrderRaw;
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      ...pagination,
      ...(provider === undefined ? {} : { provider }),
      ...(status === undefined ? {} : { status }),
      ...(from === undefined ? {} : { from }),
      ...(to === undefined ? {} : { to }),
      ...(startedAtOrder === undefined ? {} : { started_at_order: startedAtOrder }),
    },
  };
}
