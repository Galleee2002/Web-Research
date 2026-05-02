"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { UserRole } from "@shared/index";
import { USER_ROLES } from "@shared/index";

const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Admin",
  user: "User",
};

type AdminUserRoleSelectProps = {
  role: UserRole;
  onRoleChange: (role: UserRole) => void | Promise<void>;
};

export function AdminUserRoleSelect({ role, onRoleChange }: AdminUserRoleSelectProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      const el = wrapRef.current;
      if (!el || el.contains(event.target as Node)) {
        return;
      }
      setOpen(false);
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = async (next: UserRole) => {
    setOpen(false);
    triggerRef.current?.focus();
    if (next !== role) {
      await onRoleChange(next);
    }
  };

  return (
    <div className="admin-users__role-field">
      <span className="admin-users__role-label" id={`${listId}-label`}>
        Role
      </span>
      <div className="admin-users__role-wrap" ref={wrapRef}>
        <button
          ref={triggerRef}
          type="button"
          className="admin-users__role-trigger"
          aria-labelledby={`${listId}-label`}
          aria-expanded={open ? "true" : "false"}
          aria-haspopup="listbox"
          aria-controls={listId}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="admin-users__role-trigger-text">{ROLE_LABEL[role]}</span>
          <ChevronDown
            className={`admin-users__role-chevron${open ? " admin-users__role-chevron--open" : ""}`}
            size={18}
            strokeWidth={2}
            aria-hidden
          />
        </button>
        {open ? (
          <ul className="admin-users__role-menu" role="listbox" id={listId} aria-label="Role">
            {USER_ROLES.map((value) => (
              <li key={value} role="presentation">
                <button
                  type="button"
                  className={
                    value === role
                      ? "admin-users__role-option admin-users__role-option--active"
                      : "admin-users__role-option"
                  }
                  role="option"
                  aria-selected={value === role ? "true" : "false"}
                  onClick={() => void pick(value)}
                >
                  {ROLE_LABEL[value]}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
