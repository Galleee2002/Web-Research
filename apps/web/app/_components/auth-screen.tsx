"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { AuthRadar } from "./auth-radar-background/radar";

export function AuthScreen({ children }: { children: React.ReactNode }) {
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

  const themeLabel =
    theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  const ThemeIcon = theme === "dark" ? Sun : Moon;

  const radarLight = theme === "light";

  const mainClass = radarLight
    ? "auth-main auth-main--radar auth-main--radar-light"
    : "auth-main auth-main--radar";

  return (
    <main className={mainClass}>
      <div className="auth-main__radar" aria-hidden>
        <AuthRadar
          speed={0.3}
          scale={0.5}
          ringCount={6}
          spokeCount={10}
          ringThickness={0.07}
          spokeThickness={0.01}
          sweepSpeed={1.0}
          sweepWidth={7}
          sweepLobes={1}
          color="#0071E3"
          backgroundColor={radarLight ? "#f5f5f7" : "#000000"}
          falloff={1.2}
          brightness={1.0}
          isLightBackground={radarLight}
          enableMouseInteraction
          mouseInfluence={0.2}
        />
      </div>
      <div className="auth-main__stack">
        <header className="auth-top-nav">
          <h1 className="auth-top-nav__brand">GRG</h1>
          <button
            type="button"
            className="dashboard-theme-toggle auth-top-nav__theme"
            onClick={handleThemeToggle}
            aria-label={themeLabel}
            title={themeLabel}
          >
            <ThemeIcon className="dashboard-theme-toggle__icon" aria-hidden />
          </button>
        </header>
        <div className="auth-main__content">{children}</div>
      </div>
    </main>
  );
}
