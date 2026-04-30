import type {
  AuthProfileUpdate,
  AuthRegistration,
  AuthUser,
  UserRole,
} from "@shared/index";

import type { OperationContext } from "@/lib/api/http";

import { query } from "./pool";
import { toIsoString } from "./shared-query";

export interface UserCreateInput {
  username: AuthRegistration["username"];
  email: AuthRegistration["email"];
  first_name: string;
  last_name: string;
  phone: string | null;
  password_hash: string;
  role: UserRole;
}

export interface UserWithPassword extends AuthUser {
  password_hash: string;
  session_version: number;
}

interface UserRow {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  password_hash?: string;
  session_version?: number;
  role: UserRole;
  created_at: Date | string;
  updated_at: Date | string;
  last_login_at: Date | string | null;
}

const USER_PUBLIC_SELECT = `
  id,
  username,
  email,
  first_name,
  last_name,
  phone,
  role,
  created_at,
  updated_at,
  last_login_at
`;

export function mapUser(row: UserRow): AuthUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    first_name: row.first_name,
    last_name: row.last_name,
    phone: row.phone,
    role: row.role,
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
    last_login_at: row.last_login_at ? toIsoString(row.last_login_at) : null,
  };
}

function mapUserWithPassword(row: UserRow): UserWithPassword {
  return {
    ...mapUser(row),
    password_hash: row.password_hash ?? "",
    session_version: row.session_version ?? 1,
  };
}

export async function createUser(
  input: UserCreateInput,
  context: OperationContext,
): Promise<AuthUser> {
  const result = await query<UserRow>(
    `
      insert into users (
        username,
        email,
        first_name,
        last_name,
        phone,
        password_hash,
        role
      )
      values ($1, $2, $3, $4, $5, $6, $7)
      returning ${USER_PUBLIC_SELECT}
    `,
    [
      input.username,
      input.email,
      input.first_name,
      input.last_name,
      input.phone,
      input.password_hash,
      input.role,
    ],
    { operationName: "create_user", context },
  );

  return mapUser(result.rows[0]);
}

export async function findUserByEmailOrUsername(
  identity: string,
  context: OperationContext,
): Promise<UserWithPassword | null> {
  const result = await query<UserRow>(
    `
      select ${USER_PUBLIC_SELECT}, password_hash, session_version
      from users
      where lower(email) = lower($1) or lower(username) = lower($1)
      limit 1
    `,
    [identity],
    { operationName: "find_user_by_identity", context },
  );

  return result.rows[0] ? mapUserWithPassword(result.rows[0]) : null;
}

export async function findUserById(
  id: string,
  context: OperationContext,
): Promise<AuthUser | null> {
  const result = await query<UserRow>(
    `
      select ${USER_PUBLIC_SELECT}
      from users
      where id = $1
      limit 1
    `,
    [id],
    { operationName: "find_user_by_id", context },
  );

  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function markUserLogin(
  id: string,
  context: OperationContext,
): Promise<AuthUser | null> {
  const result = await query<UserRow>(
    `
      update users
      set last_login_at = now(), updated_at = now()
      where id = $1
      returning ${USER_PUBLIC_SELECT}
    `,
    [id],
    { operationName: "mark_user_login", context },
  );

  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function updateUserProfile(
  id: string,
  input: AuthProfileUpdate,
  context: OperationContext,
): Promise<AuthUser | null> {
  const result = await query<UserRow>(
    `
      update users
      set
        first_name = case when $2::boolean then $3::text else first_name end,
        last_name = case when $4::boolean then $5::text else last_name end,
        phone = case when $6::boolean then $7::text else phone end,
        email = case when $8::boolean then $9::text else email end,
        updated_at = now()
      where id = $1
      returning ${USER_PUBLIC_SELECT}
    `,
    [
      id,
      Object.hasOwn(input, "firstName"),
      input.firstName ?? null,
      Object.hasOwn(input, "lastName"),
      input.lastName ?? null,
      Object.hasOwn(input, "phone"),
      input.phone ?? null,
      Object.hasOwn(input, "email"),
      input.email ?? null,
    ],
    { operationName: "update_user_profile", context },
  );

  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function listUsers(context: OperationContext): Promise<AuthUser[]> {
  const result = await query<UserRow>(
    `
      select ${USER_PUBLIC_SELECT}
      from users
      order by created_at desc
    `,
    [],
    { operationName: "list_users", context },
  );

  return result.rows.map(mapUser);
}

export async function updateUserRole(
  id: string,
  role: UserRole,
  context: OperationContext,
): Promise<AuthUser | null> {
  const result = await query<UserRow>(
    `
      update users
      set role = $2, updated_at = now()
      where id = $1
      returning ${USER_PUBLIC_SELECT}
    `,
    [id, role],
    { operationName: "update_user_role", context },
  );

  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function getUserSessionVersion(
  id: string,
  context: OperationContext,
): Promise<number | null> {
  const result = await query<{ session_version: number }>(
    `
      select session_version
      from users
      where id = $1
      limit 1
    `,
    [id],
    { operationName: "get_user_session_version", context },
  );

  return result.rows[0]?.session_version ?? null;
}

export async function incrementUserSessionVersion(
  id: string,
  context: OperationContext,
): Promise<number | null> {
  const result = await query<{ session_version: number }>(
    `
      update users
      set session_version = session_version + 1, updated_at = now()
      where id = $1
      returning session_version
    `,
    [id],
    { operationName: "increment_user_session_version", context },
  );

  return result.rows[0]?.session_version ?? null;
}
