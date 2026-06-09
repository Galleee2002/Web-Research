import { isLeadStatus } from "../constants/domain";
import { INPUT_LIMITS } from "../constants/pagination";
import type { LeadStatus } from "../constants/domain";
import type {
  BusinessCreate,
  BusinessFilters,
  BusinessStatusUpdate,
  BusinessUpdate,
} from "../types/business";
import {
  isRecord,
  parseOptionalString,
  parseRequiredString,
  parseStrictPaginationParams,
  type ValidationResult,
} from "./pagination";

const ORDER_BY_FIELDS = ["created_at", "name", "city"] as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const HTTP_URL_RE = /^https?:\/\/.+/i;

const BUSINESS_UPDATE_FIELDS = [
  "name",
  "category",
  "email",
  "phone",
  "social_links",
  "website",
  "maps_url",
  "notes",
  "address",
  "status",
] as const;

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

function parseBusinessName(value: unknown, errors: string[]): string | undefined {
  if (typeof value !== "string") {
    errors.push("name must be a string");
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    errors.push("name must not be empty");
    return undefined;
  }
  if (trimmed.length > INPUT_LIMITS.textSearch) {
    errors.push(`name must be ${INPUT_LIMITS.textSearch} characters or fewer`);
    return undefined;
  }
  return trimmed;
}

function parseNullableStringField(
  value: unknown,
  key: string,
  maxLength: number,
  errors: string[],
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    errors.push(`${key} must be a string or null`);
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > maxLength) {
    errors.push(`${key} must be ${maxLength} characters or fewer`);
    return undefined;
  }
  return trimmed;
}

function parseOptionalEmail(
  value: unknown,
  errors: string[],
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    errors.push("email must be a string or null");
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const normalized = trimmed.toLowerCase();
  if (!EMAIL_RE.test(normalized) || normalized.length > INPUT_LIMITS.email) {
    errors.push("email must be a valid email address");
    return undefined;
  }
  return normalized;
}

function parseHttpUrl(value: string, key: string, errors: string[]): string | undefined {
  if (value.length > INPUT_LIMITS.socialLink) {
    errors.push(`${key} must be ${INPUT_LIMITS.socialLink} characters or fewer`);
    return undefined;
  }
  if (!HTTP_URL_RE.test(value)) {
    errors.push(`${key} must be a valid http or https URL`);
    return undefined;
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      errors.push(`${key} must be a valid http or https URL`);
      return undefined;
    }
    if (!parsed.hostname) {
      errors.push(`${key} must be a valid http or https URL`);
      return undefined;
    }
  } catch {
    errors.push(`${key} must be a valid http or https URL`);
    return undefined;
  }
  return value;
}

function parseSocialLinks(
  value: unknown,
  errors: string[],
): string[] | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (!Array.isArray(value)) {
    errors.push("social_links must be an array of URLs or null");
    return undefined;
  }
  if (value.length > INPUT_LIMITS.maxSocialLinks) {
    errors.push(`social_links must contain at most ${INPUT_LIMITS.maxSocialLinks} URLs`);
    return undefined;
  }
  const links: string[] = [];
  const seen = new Set<string>();
  for (const [index, item] of value.entries()) {
    if (typeof item !== "string") {
      errors.push(`social_links[${index}] must be a string`);
      continue;
    }
    const trimmed = item.trim();
    if (trimmed.length === 0) {
      continue;
    }
    const parsed = parseHttpUrl(trimmed, `social_links[${index}]`, errors);
    if (parsed && !seen.has(parsed.toLowerCase())) {
      seen.add(parsed.toLowerCase());
      links.push(parsed);
    }
  }
  return links;
}

function parseOptionalWebsite(
  value: unknown,
  errors: string[],
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    errors.push("website must be a string or null");
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return parseHttpUrl(trimmed, "website", errors) ?? undefined;
}

export function parseBusinessCreate(input: unknown): ValidationResult<BusinessCreate> {
  if (!isRecord(input)) {
    return { ok: false, errors: ["payload must be an object"] };
  }

  const errors: string[] = [];

  if (!Object.hasOwn(input, "name")) {
    errors.push("name is required");
  }
  const name = Object.hasOwn(input, "name")
    ? parseBusinessName(input.name, errors)
    : undefined;

  const category = Object.hasOwn(input, "category")
    ? parseNullableStringField(input.category, "category", INPUT_LIMITS.category, errors)
    : undefined;
  const email = Object.hasOwn(input, "email")
    ? parseOptionalEmail(input.email, errors)
    : undefined;
  const phone = Object.hasOwn(input, "phone")
    ? parseNullableStringField(input.phone, "phone", INPUT_LIMITS.phone, errors)
    : undefined;
  const socialLinks = Object.hasOwn(input, "social_links")
    ? parseSocialLinks(input.social_links, errors)
    : undefined;
  const website = Object.hasOwn(input, "website")
    ? parseOptionalWebsite(input.website, errors)
    : undefined;
  const mapsUrl = Object.hasOwn(input, "maps_url")
    ? parseOptionalWebsite(input.maps_url, errors)
    : undefined;
  const notes = Object.hasOwn(input, "notes")
    ? parseNullableStringField(input.notes, "notes", INPUT_LIMITS.notes, errors)
    : undefined;
  const address = Object.hasOwn(input, "address")
    ? parseNullableStringField(input.address, "address", INPUT_LIMITS.address, errors)
    : undefined;

  if (errors.length > 0 || name === undefined) {
    return { ok: false, errors };
  }

  const value: BusinessCreate = { name };
  if (category !== undefined) value.category = category;
  if (email !== undefined) value.email = email;
  if (phone !== undefined) value.phone = phone;
  if (socialLinks !== undefined) value.social_links = socialLinks ?? [];
  if (website !== undefined) value.website = website;
  if (mapsUrl !== undefined) value.maps_url = mapsUrl;
  if (notes !== undefined) value.notes = notes;
  if (address !== undefined) value.address = address;

  return { ok: true, value };
}

export function parseBusinessUpdate(input: unknown): ValidationResult<BusinessUpdate> {
  if (!isRecord(input)) {
    return { ok: false, errors: ["payload must be an object"] };
  }

  const errors: string[] = [];
  const value: BusinessUpdate = {};
  let hasField = false;

  if (Object.hasOwn(input, "name")) {
    const parsed = parseBusinessName(input.name, errors);
    if (parsed !== undefined) {
      value.name = parsed;
    }
    hasField = true;
  }

  if (Object.hasOwn(input, "category")) {
    const parsed = parseNullableStringField(
      input.category,
      "category",
      INPUT_LIMITS.category,
      errors,
    );
    if (parsed !== undefined) {
      value.category = parsed;
    }
    hasField = true;
  }

  if (Object.hasOwn(input, "email")) {
    const parsed = parseOptionalEmail(input.email, errors);
    if (parsed !== undefined) {
      value.email = parsed;
    }
    hasField = true;
  }

  if (Object.hasOwn(input, "phone")) {
    const parsed = parseNullableStringField(
      input.phone,
      "phone",
      INPUT_LIMITS.phone,
      errors,
    );
    if (parsed !== undefined) {
      value.phone = parsed;
    }
    hasField = true;
  }

  if (Object.hasOwn(input, "social_links")) {
    const parsed = parseSocialLinks(input.social_links, errors);
    if (parsed !== undefined) {
      value.social_links = parsed;
    }
    hasField = true;
  }

  if (Object.hasOwn(input, "website")) {
    const parsed = parseOptionalWebsite(input.website, errors);
    if (parsed !== undefined) {
      value.website = parsed;
    }
    hasField = true;
  }

  if (Object.hasOwn(input, "maps_url")) {
    const parsed = parseOptionalWebsite(input.maps_url, errors);
    if (parsed !== undefined) {
      value.maps_url = parsed;
    }
    hasField = true;
  }

  if (Object.hasOwn(input, "notes")) {
    const parsed = parseNullableStringField(
      input.notes,
      "notes",
      INPUT_LIMITS.notes,
      errors,
    );
    if (parsed !== undefined) {
      value.notes = parsed;
    }
    hasField = true;
  }

  if (Object.hasOwn(input, "address")) {
    const parsed = parseNullableStringField(
      input.address,
      "address",
      INPUT_LIMITS.address,
      errors,
    );
    if (parsed !== undefined) {
      value.address = parsed;
    }
    hasField = true;
  }

  if (Object.hasOwn(input, "status")) {
    if (!isLeadStatus(input.status)) {
      errors.push("status is not a valid lead status");
    } else {
      value.status = input.status;
    }
    hasField = true;
  }

  if (!hasField) {
    return {
      ok: false,
      errors: [
        `at least one of ${BUSINESS_UPDATE_FIELDS.join(", ")} is required`,
      ],
    };
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value };
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
