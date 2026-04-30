import type { UserRole } from "../constants/domain";

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface AuthSession {
  user: AuthUser;
}

export interface AuthRegistration {
  username: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string;
  password: string;
}

export interface AuthLogin {
  emailOrUsername: string;
  password: string;
}

export interface AuthProfileUpdate {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  email?: string;
}

export interface UserRoleUpdate {
  role: UserRole;
}
