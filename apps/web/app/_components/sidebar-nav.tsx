"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import {
  Bell,
  BriefcaseBusiness,
  ChartColumn,
  ChartPie,
  FolderOpen,
  LayoutDashboard,
  Link2,
  Moon,
  ScanSearch,
  Settings,
  Sun
} from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
};

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Businesses", href: "/businesses", icon: BriefcaseBusiness },
  { label: "Opportunities", href: "/opportunities", icon: FolderOpen },
  { label: "Scans", href: "/scans", icon: ScanSearch },
  { label: "Alerts", href: "/alerts", icon: Bell },
  { label: "Analytics", href: "/analytics", icon: ChartPie },
  { label: "Reports", href: "/reports", icon: ChartColumn },
  { label: "Integrations", href: "/integrations", icon: Link2 },
  { label: "Settings", href: "/settings", icon: Settings }
];

const isRouteActive = (pathname: string, href: string): boolean => {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname.startsWith(href);
};

export function SidebarNav() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"dark" | "light">("light");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("theme");
    const initialTheme =
      savedTheme === "light" || savedTheme === "dark" ? savedTheme : "light";

    document.documentElement.setAttribute("data-theme", initialTheme);
    setTheme(initialTheme);
  }, []);

  const handleThemeToggle = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", nextTheme);
    window.localStorage.setItem("theme", nextTheme);
    setTheme(nextTheme);
  };

  const ThemeIcon = theme === "dark" ? Sun : Moon;
  const themeLabel = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  return (
    <aside className="dashboard-sidebar" aria-label="Primary">
      <div className="dashboard-sidebar__header">
        <p className="dashboard-sidebar__eyebrow">Business Lead Finder</p>
        <h1 className="dashboard-sidebar__title">GRG Solutions</h1>
      </div>

      <nav className="dashboard-nav" aria-label="Dashboard sections">
        <ul className="dashboard-nav__list">
          {navItems.map((item) => {
            const active = isRouteActive(pathname, item.href);
            const Icon = item.icon;

            return (
              <li key={item.href} className="dashboard-nav__item">
                <Link
                  href={item.href}
                  className="dashboard-nav__link"
                  data-active={active}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="dashboard-nav__icon" aria-hidden />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          className="dashboard-theme-toggle"
          onClick={handleThemeToggle}
          aria-label={themeLabel}
          title={themeLabel}
        >
          <ThemeIcon className="dashboard-theme-toggle__icon" aria-hidden />
        </button>
      </nav>
    </aside>
  );
}
