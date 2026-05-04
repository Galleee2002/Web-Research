"use client";

import { useEffect } from "react";

import CircularText from "@/app/_components/circular-text/CircularText";

const EXIT_FALLBACK_MS = 600;

type AuthEnterOverlayProps = {
  exiting: boolean;
  onExitComplete: () => void;
};

export function AuthEnterOverlay({ exiting, onExitComplete }: AuthEnterOverlayProps) {
  useEffect(() => {
    if (!exiting) {
      return;
    }
    const id = window.setTimeout(() => {
      onExitComplete();
    }, EXIT_FALLBACK_MS);
    return () => window.clearTimeout(id);
  }, [exiting, onExitComplete]);

  return (
    <div
      className={
        exiting
          ? "auth-enter-overlay auth-enter-overlay--exiting"
          : "auth-enter-overlay"
      }
      role="status"
      aria-live="polite"
      aria-busy={!exiting}
      aria-label="Signing in"
      onTransitionEnd={(event) => {
        if (event.target !== event.currentTarget) {
          return;
        }
        if (event.propertyName !== "opacity") {
          return;
        }
        if (exiting) {
          onExitComplete();
        }
      }}
    >
      <div className="auth-enter-overlay__backdrop" aria-hidden />
      <div className="auth-enter-overlay__content">
        <CircularText
          text="BUSINESS * LEAD * FINDER * "
          spinDuration={20}
          className="auth-enter-overlay__circular"
        />
      </div>
    </div>
  );
}
