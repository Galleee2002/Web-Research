import { isUserRole } from "../constants/domain";
import type {
  AuthLogin,
  AuthProfileUpdate,
  AuthRegistration,
  UserRoleUpdate,
} from "../types/auth";
import { isRecord, type ValidationResult } from "./pagination";

const USERNAME_RE = /^[a-z0-9_][a-z0-9_-]*$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9() .-]{7,32}$/;

function parseName(value: unknown, key: string, errors: string[]): string | undefined {
  if (typeof value !== "string") {
    errors.push(`${key} must be a string`);
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    errors.push(`${key} is required`);
    return undefined;
  }
  if (trimmed.length > 80) {
    errors.push(`${key} must be 80 characters or fewer`);
    return undefined;
  }

  return trimmed;
}

function parseUsername(value: unknown, errors: string[]): string | undefined {
  if (typeof value !== "string") {
    errors.push("username must be a string");
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized.length < 3 || normalized.length > 32) {
    errors.push("username must be between 3 and 32 characters");
    return undefined;
  }
  if (!USERNAME_RE.test(normalized)) {
    errors.push("username may contain only letters, numbers, underscores, and hyphens");
    return undefined;
  }

  return normalized;
}

function parseEmail(value: unknown, errors: string[]): string | undefined {
  if (typeof value !== "string") {
    errors.push("email must be a string");
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (!EMAIL_RE.test(normalized) || normalized.length > 254) {
    errors.push("email must be a valid email address");
    return undefined;
  }

  return normalized;
}

function parsePassword(value: unknown, errors: string[]): string | undefined {
  if (typeof value !== "string") {
    errors.push("password must be a string");
    return undefined;
  }
  if (value.length < 12) {
    errors.push("password must be at least 12 characters");
    return undefined;
  }
  if (value.length > 128) {
    errors.push("password must be 128 characters or fewer");
    return undefined;
  }

  return value;
}

function parsePhone(value: unknown, errors: string[]): string | null | undefined {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    errors.push("phone must be a string");
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (!PHONE_RE.test(trimmed)) {
    errors.push("phone must be a valid phone number");
    return undefined;
  }

  return trimmed;
}

export function parseAuthRegistration(input: unknown): ValidationResult<AuthRegistration> {
  if (!isRecord(input)) {
    return { ok: false, errors: ["payload must be an object"] };
  }

  const errors: string[] = [];
  const username = parseUsername(input.username, errors);
  const firstName = parseName(input.firstName, "firstName", errors);
  const lastName = parseName(input.lastName, "lastName", errors);
  const phone = parsePhone(input.phone, errors);
  const email = parseEmail(input.email, errors);
  const password = parsePassword(input.password, errors);

  if (
    errors.length > 0 ||
    username === undefined ||
    firstName === undefined ||
    lastName === undefined ||
    phone === undefined ||
    email === undefined ||
    password === undefined
  ) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: { username, firstName, lastName, phone, email, password },
  };
}

export function parseAuthLogin(input: unknown): ValidationResult<AuthLogin> {
  if (!isRecord(input)) {
    return { ok: false, errors: ["payload must be an object"] };
  }

  const errors: string[] = [];
  let emailOrUsername: string | undefined;
  if (typeof input.emailOrUsername !== "string") {
    errors.push("emailOrUsername must be a string");
  } else {
    emailOrUsername = input.emailOrUsername.trim().toLowerCase();
    if (emailOrUsername.length === 0) {
      errors.push("emailOrUsername is required");
    }
  }
  const password = parsePassword(input.password, errors);

  if (errors.length > 0 || emailOrUsername === undefined || password === undefined) {
    return { ok: false, errors };
  }

  return { ok: true, value: { emailOrUsername, password } };
}

export function parseAuthProfileUpdate(input: unknown): ValidationResult<AuthProfileUpdate> {
  if (!isRecord(input)) {
    return { ok: false, errors: ["payload must be an object"] };
  }

  const errors: string[] = [];
  const value: AuthProfileUpdate = {};

  if (input.firstName !== undefined) {
    const firstName = parseName(input.firstName, "firstName", errors);
    if (firstName !== undefined) {
      value.firstName = firstName;
    }
  }
  if (input.lastName !== undefined) {
    const lastName = parseName(input.lastName, "lastName", errors);
    if (lastName !== undefined) {
      value.lastName = lastName;
    }
  }
  if (input.phone !== undefined) {
    const phone = parsePhone(input.phone, errors);
    if (phone !== undefined) {
      value.phone = phone;
    }
  }
  if (input.email !== undefined) {
    const email = parseEmail(input.email, errors);
    if (email !== undefined) {
      value.email = email;
    }
  }

  if (Object.keys(value).length === 0) {
    errors.push("at least one profile field is required");
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, value };
}

export function parseUserRoleUpdate(input: unknown): ValidationResult<UserRoleUpdate> {
  if (!isRecord(input)) {
    return { ok: false, errors: ["payload must be an object"] };
  }
  if (!isUserRole(input.role)) {
    return { ok: false, errors: ["role must be admin or user"] };
  }

  return { ok: true, value: { role: input.role } };
}
