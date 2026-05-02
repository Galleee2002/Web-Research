"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { AuthEnterOverlay } from "./auth-enter-overlay";

const MIN_OVERLAY_MS = 950;

type AuthAppTransitionContextValue = {
  beginEnteringProtectedApp: () => void;
};

const AuthAppTransitionContext = createContext<AuthAppTransitionContextValue | null>(
  null
);

export function AuthAppTransitionProvider({
  children,
  isAuthRoute,
}: {
  children: React.ReactNode;
  isAuthRoute: boolean;
}) {
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [overlayExiting, setOverlayExiting] = useState(false);
  const startedAtRef = useRef<number | null>(null);

  const beginEnteringProtectedApp = useCallback(() => {
    startedAtRef.current = Date.now();
    setOverlayExiting(false);
    setOverlayOpen(true);
  }, []);

  useEffect(() => {
    if (!overlayOpen || isAuthRoute) {
      return;
    }
    const start = startedAtRef.current ?? Date.now();
    const wait = Math.max(0, MIN_OVERLAY_MS - (Date.now() - start));
    const id = window.setTimeout(() => {
      setOverlayExiting(true);
    }, wait);
    return () => window.clearTimeout(id);
  }, [overlayOpen, isAuthRoute]);

  const handleOverlayExitComplete = useCallback(() => {
    setOverlayOpen(false);
    setOverlayExiting(false);
    startedAtRef.current = null;
  }, []);

  return (
    <AuthAppTransitionContext.Provider value={{ beginEnteringProtectedApp }}>
      {children}
      {overlayOpen ? (
        <AuthEnterOverlay exiting={overlayExiting} onExitComplete={handleOverlayExitComplete} />
      ) : null}
    </AuthAppTransitionContext.Provider>
  );
}

export function useAuthAppTransition(): AuthAppTransitionContextValue {
  const ctx = useContext(AuthAppTransitionContext);
  if (!ctx) {
    throw new Error("useAuthAppTransition must be used within AuthAppTransitionProvider");
  }
  return ctx;
}
