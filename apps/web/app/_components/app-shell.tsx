"use client";

import { usePathname } from "next/navigation";

import { SidebarNav } from "./sidebar-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = pathname === "/login" || pathname === "/register";

  if (isAuthRoute) {
    return <main className="auth-main">{children}</main>;
  }

  return (
    <div className="dashboard-shell">
      <SidebarNav />
      <main id="main-content" className="dashboard-main">
        {children}
      </main>
    </div>
  );
}
