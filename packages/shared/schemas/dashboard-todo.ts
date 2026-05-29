import {
  DASHBOARD_TODO_PRIORITIES,
  DASHBOARD_TODO_STATUSES,
  INPUT_LIMITS,
} from "../constants/pagination";
import type {
  DashboardTodoCreate,
  DashboardTodoPriority,
  DashboardTodoStatus,
  DashboardTodoUpdate,
} from "../types/dashboard-todo";
import { isRecord, type ValidationResult } from "./pagination";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isUuidString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function isDashboardTodoStatus(value: unknown): value is DashboardTodoStatus {
  return (
    typeof value === "string" &&
    DASHBOARD_TODO_STATUSES.includes(value as DashboardTodoStatus)
  );
}

function isDashboardTodoPriority(
  value: unknown
): value is DashboardTodoPriority {
  return (
    typeof value === "string" &&
    DASHBOARD_TODO_PRIORITIES.includes(value as DashboardTodoPriority)
  );
}

function parseOptionalUuid(
  value: unknown,
  field: string,
  errors: string[]
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    errors.push(`${field} must be a valid UUID or null`);
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (!isUuidString(trimmed)) {
    errors.push(`${field} must be a valid UUID`);
    return undefined;
  }
  return trimmed;
}

function parseStartDate(
  value: unknown,
  errors: string[]
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    errors.push("start_date must be a YYYY-MM-DD string or null");
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (!ISO_DATE_RE.test(trimmed)) {
    errors.push("start_date must use the format YYYY-MM-DD");
    return undefined;
  }
  const date = new Date(`${trimmed}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    errors.push("start_date must be a real calendar date");
    return undefined;
  }
  return trimmed;
}

function parseName(value: unknown, errors: string[]): string | undefined {
  if (typeof value !== "string") {
    errors.push("name must be a string");
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    errors.push("name must not be empty");
    return undefined;
  }
  if (trimmed.length > INPUT_LIMITS.dashboardTodoName) {
    errors.push(
      `name must be at most ${INPUT_LIMITS.dashboardTodoName} characters`
    );
    return undefined;
  }
  return trimmed;
}

function parseDescription(
  value: unknown,
  errors: string[]
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    errors.push("description must be a string or null");
    return undefined;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > INPUT_LIMITS.dashboardTodoDescription) {
    errors.push(
      `description must be at most ${INPUT_LIMITS.dashboardTodoDescription} characters`
    );
    return undefined;
  }
  return trimmed;
}

export function parseDashboardTodoCreate(
  input: unknown
): ValidationResult<DashboardTodoCreate> {
  if (!isRecord(input)) {
    return { ok: false, errors: ["payload must be an object"] };
  }

  const errors: string[] = [];

  if (!Object.hasOwn(input, "name")) {
    errors.push("name is required");
  }
  const name = Object.hasOwn(input, "name")
    ? parseName(input.name, errors)
    : undefined;

  const businessId = Object.hasOwn(input, "business_id")
    ? parseOptionalUuid(input.business_id, "business_id", errors)
    : undefined;

  const assignedUserId = Object.hasOwn(input, "assigned_user_id")
    ? parseOptionalUuid(input.assigned_user_id, "assigned_user_id", errors)
    : undefined;

  let status: DashboardTodoStatus | undefined;
  if (Object.hasOwn(input, "status") && input.status !== undefined) {
    if (!isDashboardTodoStatus(input.status)) {
      errors.push("status must be 'pending' or 'completed'");
    } else {
      status = input.status;
    }
  }

  let priority: DashboardTodoPriority | undefined;
  if (Object.hasOwn(input, "priority") && input.priority !== undefined) {
    if (!isDashboardTodoPriority(input.priority)) {
      errors.push("priority must be 'low', 'medium', or 'high'");
    } else {
      priority = input.priority;
    }
  }

  const startDate = Object.hasOwn(input, "start_date")
    ? parseStartDate(input.start_date, errors)
    : undefined;

  const description = Object.hasOwn(input, "description")
    ? parseDescription(input.description, errors)
    : undefined;

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const value: DashboardTodoCreate = {
    name: name as string,
  };
  if (businessId !== undefined) {
    value.business_id = businessId;
  }
  if (assignedUserId !== undefined) {
    value.assigned_user_id = assignedUserId;
  }
  if (status !== undefined) {
    value.status = status;
  }
  if (priority !== undefined) {
    value.priority = priority;
  }
  if (startDate !== undefined) {
    value.start_date = startDate;
  }
  if (description !== undefined) {
    value.description = description;
  }
  return { ok: true, value };
}

export function parseDashboardTodoUpdate(
  input: unknown
): ValidationResult<DashboardTodoUpdate> {
  if (!isRecord(input)) {
    return { ok: false, errors: ["payload must be an object"] };
  }

  const errors: string[] = [];
  const value: DashboardTodoUpdate = {};
  let hasField = false;

  if (Object.hasOwn(input, "name")) {
    const parsed = parseName(input.name, errors);
    if (parsed !== undefined) {
      value.name = parsed;
    }
    hasField = true;
  }

  if (Object.hasOwn(input, "description")) {
    const parsed = parseDescription(input.description, errors);
    if (parsed === null) {
      value.description = null;
    } else if (typeof parsed === "string") {
      value.description = parsed;
    }
    hasField = true;
  }

  if (Object.hasOwn(input, "status")) {
    if (!isDashboardTodoStatus(input.status)) {
      errors.push("status must be 'pending' or 'completed'");
    } else {
      value.status = input.status;
    }
    hasField = true;
  }

  if (Object.hasOwn(input, "priority")) {
    if (!isDashboardTodoPriority(input.priority)) {
      errors.push("priority must be 'low', 'medium', or 'high'");
    } else {
      value.priority = input.priority;
    }
    hasField = true;
  }

  if (Object.hasOwn(input, "start_date")) {
    const parsed = parseStartDate(input.start_date, errors);
    if (parsed === null) {
      value.start_date = null;
    } else if (typeof parsed === "string") {
      value.start_date = parsed;
    }
    hasField = true;
  }

  if (!hasField) {
    return {
      ok: false,
      errors: [
        "at least one of name, description, status, start_date, or priority is required",
      ],
    };
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value };
}
