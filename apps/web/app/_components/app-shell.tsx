"use client";

import { usePathname } from "next/navigation";

import { AuthAppTransitionProvider } from "./auth-app-transition-context";
import { AuthScreen } from "./auth-screen";
import { SidebarNav } from "./sidebar-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = pathname === "/login" || pathname === "/register";

  return (
    <AuthAppTransitionProvider isAuthRoute={isAuthRoute}>
      {isAuthRoute ? (
        <AuthScreen>{children}</AuthScreen>
      ) : (
        <div className="dashboard-shell">
          <SidebarNav />
          <main id="main-content" className="dashboard-main">
            {children}
          </main>
        </div>
      )}
    </AuthAppTransitionProvider>
  );
}
