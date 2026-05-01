"use client";

import { useEffect, useState } from "react";

import { getCurrentUser } from "@/lib/api/auth-client";

type DashboardWelcomeBannerProps = {
  /** Sits on the same row as the page title (compact). */
  variant?: "inline" | "card";
};

export function DashboardWelcomeBanner({ variant = "card" }: DashboardWelcomeBannerProps) {
  const [firstName, setFirstName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then((user) => {
        if (!cancelled) {
          const name = user.first_name?.trim();
          setFirstName(name && name.length > 0 ? name : user.username);
        }
      })
      .catch(() => {
        if (!cancelled) setFirstName(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (firstName == null) {
    return null;
  }

  const rootClass =
    variant === "inline"
      ? "dashboard-welcome-banner dashboard-welcome-banner--inline"
      : "dashboard-welcome-banner dashboard-welcome-banner--card";

  return (
    <div className={rootClass} role="region" aria-label="Welcome back">
      <p className="dashboard-welcome-banner__text">
        Welcome back, <span className="dashboard-welcome-banner__name">{firstName}.</span>
      </p>
    </div>
  );
}
