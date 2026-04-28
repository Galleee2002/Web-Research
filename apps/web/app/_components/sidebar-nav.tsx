"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";
import type { ComponentType } from "react";
import {
  BriefcaseBusiness,
  ChartColumn,
  FolderOpen,
  LayoutDashboard,
  MoreHorizontal,
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
  { label: "Analytics", href: "/analytics", icon: ChartColumn },
  { label: "Settings", href: "/settings", icon: Settings }
];

const mobileBarItems: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Businesses", href: "/businesses", icon: BriefcaseBusiness },
  { label: "Opportunities", href: "/opportunities", icon: FolderOpen },
  { label: "Settings", href: "/settings", icon: Settings }
];

const moreSheetItems: NavItem[] = [
  { label: "Analytics", href: "/analytics", icon: ChartColumn },
  { label: "Scans", href: "/scans", icon: ScanSearch }
];

const moreRoutePrefixes = moreSheetItems.map((x) => x.href);

const isRouteActive = (pathname: string, href: string): boolean => {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname.startsWith(href);
};

export function SidebarNav() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"dark" | "light">("light");
  const [moreMounted, setMoreMounted] = useState(false);
  const [moreEntered, setMoreEntered] = useState(false);
  const [dragY, setDragY] = useState(0);
  const dragStartY = useRef(0);
  const handleDraggingRef = useRef(false);
  const bottomNavTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [navPortalNode, setNavPortalNode] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    setNavPortalNode(document.body);
  }, []);

  const moreGroupActive = moreRoutePrefixes.some((href) => isRouteActive(pathname, href));

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("theme");
    const initialTheme =
      savedTheme === "light" || savedTheme === "dark" ? savedTheme : "light";

    document.documentElement.setAttribute("data-theme", initialTheme);
    setTheme(initialTheme);
  }, []);

  useEffect(() => {
    setMoreEntered(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreMounted) {
      return;
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [moreMounted]);

  useEffect(() => {
    if (!moreMounted) {
      return;
    }

    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setMoreEntered(true));
    });

    return () => cancelAnimationFrame(id);
  }, [moreMounted]);

  useEffect(() => {
    if (!moreMounted || !moreEntered) {
      return;
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMoreEntered(false);
      }
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [moreMounted, moreEntered]);

  const handleThemeToggle = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", nextTheme);
    window.localStorage.setItem("theme", nextTheme);
    setTheme(nextTheme);
  };

  const closeMore = useCallback(() => {
    setMoreEntered(false);
  }, []);

  const openMorePanel = useCallback(() => {
    if (moreEntered) {
      return;
    }
    setDragY(0);
    if (!moreMounted) {
      setMoreMounted(true);
    } else {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setMoreEntered(true));
      });
    }
  }, [moreEntered, moreMounted]);

  const onBottomNavTouchStart = useCallback((e: React.TouchEvent<HTMLElement>) => {
    if (e.touches.length > 1) {
      bottomNavTouchStartRef.current = null;
      return;
    }
    const t = e.touches[0];
    bottomNavTouchStartRef.current = { x: t.clientX, y: t.clientY };
  }, []);

  const onBottomNavTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLElement>) => {
      const start = bottomNavTouchStartRef.current;
      bottomNavTouchStartRef.current = null;
      if (!start) {
        return;
      }
      if (e.changedTouches.length < 1) {
        return;
      }
      const t = e.changedTouches[0];
      const up = start.y - t.clientY;
      const across = Math.abs(t.clientX - start.x);
      if (up < 48) {
        return;
      }
      if (up < across * 1.15) {
        return;
      }
      if (moreEntered) {
        return;
      }
      openMorePanel();
      const blockGhostClick = (ev: MouseEvent) => {
        ev.preventDefault();
        ev.stopImmediatePropagation();
      };
      document.addEventListener("click", blockGhostClick, { capture: true, once: true });
    },
    [moreEntered, openMorePanel]
  );

  const onBottomNavTouchCancel = useCallback(() => {
    bottomNavTouchStartRef.current = null;
  }, []);

  const onSheetTransitionEnd = useCallback((e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== sheetRef.current) {
      return;
    }
    if (e.propertyName !== "transform") {
      return;
    }
    if (!moreEntered) {
      setMoreMounted(false);
      setDragY(0);
    }
  }, [moreEntered]);

  const onHandlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!moreEntered) {
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartY.current = e.clientY;
    handleDraggingRef.current = true;
    setDragY(0);
  }, [moreEntered]);

  const onHandlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!handleDraggingRef.current) {
      return;
    }
    const dy = e.clientY - dragStartY.current;
    setDragY(dy > 0 ? dy : 0);
  }, []);

  const onHandlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!handleDraggingRef.current) {
      return;
    }
    handleDraggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      void 0;
    }
    const dy = e.clientY - dragStartY.current;
    if (dy > 72) {
      setMoreEntered(false);
    }
    setDragY(0);
  }, []);

  const onHandlePointerCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!handleDraggingRef.current) {
      return;
    }
    handleDraggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      void 0;
    }
    setDragY(0);
  }, []);

  const ThemeIcon = theme === "dark" ? Sun : Moon;
  const themeLabel = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  const mobileChrome =
    navPortalNode &&
    createPortal(
      <>
        <nav
          className="mobile-bottom-nav"
          aria-label="Primary"
          onTouchStart={onBottomNavTouchStart}
          onTouchEnd={onBottomNavTouchEnd}
          onTouchCancel={onBottomNavTouchCancel}
        >
          {mobileBarItems.map((item) => {
            const active = isRouteActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="mobile-bottom-nav__link"
                data-active={active}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="mobile-bottom-nav__icon" aria-hidden />
                <span className="mobile-bottom-nav__label">{item.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            className="mobile-bottom-nav__link mobile-bottom-nav__link--more"
            data-active={moreGroupActive || (moreMounted && moreEntered)}
            aria-expanded={moreMounted && moreEntered ? "true" : "false"}
            aria-haspopup="dialog"
            onClick={() => {
              if (moreEntered) {
                setMoreEntered(false);
              } else {
                openMorePanel();
              }
            }}
          >
            <MoreHorizontal className="mobile-bottom-nav__icon" aria-hidden />
            <span className="mobile-bottom-nav__label">More</span>
          </button>
        </nav>

        {moreMounted && (
          <div
            className={
              moreEntered
                ? "mobile-nav-more mobile-nav-more--entered"
                : "mobile-nav-more"
            }
            role="dialog"
            aria-modal="true"
            aria-label="More navigation"
          >
            <button
              type="button"
              className="mobile-nav-more__backdrop"
              onClick={closeMore}
              aria-label="Close menu"
            />
            <div
              ref={sheetRef}
              className={
                dragY > 0
                  ? "mobile-nav-more__sheet mobile-nav-more__sheet--dragging"
                  : "mobile-nav-more__sheet"
              }
              style={
                dragY > 0 && moreEntered
                  ? { transform: `translateY(${dragY}px)` }
                  : undefined
              }
              onTransitionEnd={onSheetTransitionEnd}
            >
              <div
                className="mobile-nav-more__handle"
                aria-hidden
                onPointerDown={onHandlePointerDown}
                onPointerMove={onHandlePointerMove}
                onPointerUp={onHandlePointerUp}
                onPointerCancel={onHandlePointerCancel}
              />
              <ul className="mobile-nav-more__list">
                {moreSheetItems.map((item) => {
                  const active = isRouteActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href} className="mobile-nav-more__item">
                      <Link
                        href={item.href}
                        className="mobile-nav-more__link"
                        data-active={active}
                        aria-current={active ? "page" : undefined}
                      >
                        <Icon className="mobile-nav-more__link-icon" aria-hidden />
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}
      </>,
      navPortalNode
    );

  return (
    <>
      <aside className="dashboard-sidebar" aria-label="Primary">
        <div className="dashboard-sidebar__header">
          <div className="dashboard-sidebar__header-text">
            <p className="dashboard-sidebar__eyebrow">Business Lead Finder</p>
            <h1 className="dashboard-sidebar__title">GRG Solutions</h1>
          </div>
        </div>

        <nav className="dashboard-nav dashboard-nav--desktop" aria-label="Dashboard sections">
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
            className="dashboard-theme-toggle dashboard-theme-toggle--nav-corner"
            onClick={handleThemeToggle}
            aria-label={themeLabel}
            title={themeLabel}
          >
            <ThemeIcon className="dashboard-theme-toggle__icon" aria-hidden />
          </button>
        </nav>
      </aside>
      {mobileChrome}
    </>
  );
}
