import { INPUT_LIMITS } from "../constants/pagination";
import type {
  DashboardTodoCompletedUpdate,
  DashboardTodoCreate,
} from "../types/dashboard-todo";
import { isRecord, type ValidationResult } from "./pagination";

function isUuidString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

export function parseDashboardTodoCreate(
  input: unknown
): ValidationResult<DashboardTodoCreate> {
  if (!isRecord(input)) {
    return { ok: false, errors: ["payload must be an object"] };
  }

  const errors: string[] = [];

  if (!Object.hasOwn(input, "title")) {
    errors.push("title is required");
  } else if (typeof input.title !== "string") {
    errors.push("title must be a string");
  } else {
    const trimmed = input.title.trim();
    if (trimmed.length === 0) {
      errors.push("title must not be empty");
    } else if (trimmed.length > INPUT_LIMITS.dashboardTodoTitle) {
      errors.push(`title must be at most ${INPUT_LIMITS.dashboardTodoTitle} characters`);
    }
  }

  if (!Object.hasOwn(input, "business_id")) {
    errors.push("business_id is required");
  } else if (!isUuidString(input.business_id)) {
    errors.push("business_id must be a valid UUID");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      title: (input.title as string).trim(),
      business_id: input.business_id as string,
    },
  };
}

export function parseDashboardTodoCompletedUpdate(
  input: unknown
): ValidationResult<DashboardTodoCompletedUpdate> {
  if (!isRecord(input)) {
    return { ok: false, errors: ["payload must be an object"] };
  }

  if (!Object.hasOwn(input, "completed")) {
    return { ok: false, errors: ["completed is required"] };
  }

  if (typeof input.completed !== "boolean") {
    return { ok: false, errors: ["completed must be a boolean"] };
  }

  return { ok: true, value: { completed: input.completed } };
}
