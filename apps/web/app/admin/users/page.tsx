"use client";

import { useEffect, useState } from "react";
import type { AuthUser, UserRole } from "@shared/index";

import { listAdminUsers, updateAdminUserRole } from "@/lib/api/auth-client";

import { AdminUserRoleSelect } from "./admin-user-role-select";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    listAdminUsers()
      .then(setUsers)
      .catch((err) => setFeedback(err instanceof Error ? err.message : "Unable to load users"));
  }, []);

  const changeRole = async (id: string, role: UserRole) => {
    setFeedback(null);
    try {
      const updated = await updateAdminUserRole(id, { role });
      setUsers((current) => current.map((user) => (user.id === id ? updated : user)));
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Unable to update role");
    }
  };

  return (
    <section className="dashboard-content">
      <header className="dashboard-content__header">
        <h2>Admin Users</h2>
        <p className="dashboard-section-note">Manage account roles.</p>
      </header>
      <div className="admin-users">
        {feedback && <p className="auth-form__error">{feedback}</p>}
        <div className="admin-users__list">
          {users.map((user) => (
            <article className="admin-users__row" key={user.id}>
              <div>
                <h3>{`${user.first_name} ${user.last_name}`}</h3>
                <p>{user.email}</p>
                <p>@{user.username}</p>
              </div>
              <AdminUserRoleSelect role={user.role} onRoleChange={(r) => changeRole(user.id, r)} />
            </article>
          ))}
          {users.length === 0 && !feedback && (
            <p className="dashboard-section-note">No users found.</p>
          )}
        </div>
      </div>
    </section>
  );
}
