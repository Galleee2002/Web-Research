"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { register } from "@/lib/api/auth-client";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    username: "",
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const updateField =
    (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
    };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await register({ ...form, phone: form.phone.trim() || null });
      router.replace("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to register");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="auth-card" aria-labelledby="register-title">
      <p className="auth-card__eyebrow">Business Lead Finder</p>
      <h1 id="register-title">Create account</h1>
      <p className="auth-card__subtitle">New accounts start with the user role.</p>
      <form className="auth-form auth-form--grid" onSubmit={handleSubmit}>
        <label>
          Username
          <input value={form.username} onChange={updateField("username")} required />
        </label>
        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={updateField("email")}
            autoComplete="email"
            required
          />
        </label>
        <label>
          First name
          <input
            value={form.firstName}
            onChange={updateField("firstName")}
            autoComplete="given-name"
            required
          />
        </label>
        <label>
          Last name
          <input
            value={form.lastName}
            onChange={updateField("lastName")}
            autoComplete="family-name"
            required
          />
        </label>
        <label>
          Phone
          <input value={form.phone} onChange={updateField("phone")} autoComplete="tel" />
        </label>
        <label>
          Password
          <input
            type="password"
            value={form.password}
            onChange={updateField("password")}
            autoComplete="new-password"
            minLength={12}
            required
          />
        </label>
        {error && <p className="auth-form__error auth-form__wide">{error}</p>}
        <button className="auth-form__wide" type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Create account"}
        </button>
      </form>
      <p className="auth-card__footer">
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </section>
  );
}
