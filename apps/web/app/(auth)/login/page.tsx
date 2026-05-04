"use client";

import { Eye } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuthAppTransition } from "@/app/_components/auth-app-transition-context";
import { login } from "@/lib/api/auth-client";

/** Twelve bullets so the empty password field hints at length like masked input. */
const PASSWORD_PLACEHOLDER = "\u2022".repeat(12);

export default function LoginPage() {
  const { beginEnteringProtectedApp } = useAuthAppTransition();
  const router = useRouter();
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const hidePassword = () => setPasswordVisible(false);

  const handleRevealPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setPasswordVisible(true);
  };

  const handleRevealPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    hidePassword();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login({ emailOrUsername, password });
      beginEnteringProtectedApp();
      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to log in");
      setSubmitting(false);
    }
  };

  return (
    <section className="auth-card" aria-labelledby="login-title">
      <p className="auth-card__eyebrow">Business Lead Finder</p>
      <h1 id="login-title">Sign in</h1>
      <p className="auth-card__subtitle">Use your account to access the dashboard.</p>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Email or username
          <input
            value={emailOrUsername}
            onChange={(event) => setEmailOrUsername(event.target.value)}
            autoComplete="username"
            placeholder="you@example.com or username"
            required
          />
        </label>
        <label>
          Password
          <div className="auth-form__password-field">
            <input
              type={passwordVisible ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              minLength={12}
              placeholder={PASSWORD_PLACEHOLDER}
              required
            />
            <button
              type="button"
              className="auth-form__reveal-password"
              aria-label="Hold to show password"
              onPointerDown={handleRevealPointerDown}
              onPointerUp={handleRevealPointerUp}
              onPointerCancel={handleRevealPointerUp}
            >
              <Eye size={20} strokeWidth={2} aria-hidden />
            </button>
          </div>
        </label>
        {error && <p className="auth-form__error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <p className="auth-card__footer">
        Don&apos;t have an account? <Link href="/register">Register now</Link>
      </p>
    </section>
  );
}
