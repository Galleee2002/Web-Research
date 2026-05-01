"use client";

import { Eye } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";

import { register } from "@/lib/api/auth-client";

const PASSWORD_PLACEHOLDER = "\u2022".repeat(12);
const MIN_PASSWORD_LENGTH = 12;

function createPressToRevealHandlers(setVisible: React.Dispatch<React.SetStateAction<boolean>>) {
  return {
    onPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setVisible(true);
    },
    onPointerUp(event: React.PointerEvent<HTMLButtonElement>) {
      setVisible(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
  };
}

const REGISTER_PLACEHOLDER_SETS = [
  {
    username: "manuelRodriguez",
    email: "manuel@example.com",
    firstName: "Manuel",
    lastName: "Rodriguez Garcia",
  },
  {
    username: "gaelGarcia",
    email: "gael@example.com",
    firstName: "Gael",
    lastName: "Garcia",
  },
] as const;

export default function RegisterPage() {
  const router = useRouter();
  const [placeholders] = useState(
    () => REGISTER_PLACEHOLDER_SETS[Math.floor(Math.random() * REGISTER_PLACEHOLDER_SETS.length)]
  );
  const [form, setForm] = useState({
    username: "",
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    password: "",
  });
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordConfirmVisible, setPasswordConfirmVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const passwordReveal = createPressToRevealHandlers(setPasswordVisible);
  const confirmPasswordReveal = createPressToRevealHandlers(setPasswordConfirmVisible);

  const canSubmit =
    form.username.trim().length > 0 &&
    form.email.trim().length > 0 &&
    form.firstName.trim().length > 0 &&
    form.lastName.trim().length > 0 &&
    form.phone.trim().length > 0 &&
    form.password.length >= MIN_PASSWORD_LENGTH &&
    passwordConfirm.length >= MIN_PASSWORD_LENGTH &&
    form.password === passwordConfirm;

  const updateField =
    (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
    };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    if (form.password !== passwordConfirm) {
      setError("Passwords do not match");
      setSubmitting(false);
      return;
    }
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
      <p className="auth-card__subtitle">Please fill in all fields to create an account.</p>
      <form className="auth-form auth-form--grid" onSubmit={handleSubmit}>
        <label>
          Username
          <input
            value={form.username}
            onChange={updateField("username")}
            autoComplete="username"
            placeholder={placeholders.username}
            required
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={updateField("email")}
            autoComplete="email"
            placeholder={placeholders.email}
            required
          />
        </label>
        <label>
          First name
          <input
            value={form.firstName}
            onChange={updateField("firstName")}
            autoComplete="given-name"
            placeholder={placeholders.firstName}
            required
          />
        </label>
        <label>
          Last name
          <input
            value={form.lastName}
            onChange={updateField("lastName")}
            autoComplete="family-name"
            placeholder={placeholders.lastName}
            required
          />
        </label>
        <div className="auth-form__phone-group auth-form__wide">
          <div className="auth-form__phone-row-labels">
            <label htmlFor="register-phone-input">Phone</label>
          </div>
          <PhoneInput
            international
            defaultCountry="US"
            className="auth-form__phone-input"
            value={form.phone || undefined}
            onChange={(value) => setForm((current) => ({ ...current, phone: value ?? "" }))}
            countrySelectProps={{
              id: "register-phone-country",
              name: "phone-country",
              "aria-label": "Country calling code",
            }}
            numberInputProps={{
              id: "register-phone-input",
              autoComplete: "tel",
            }}
            placeholder="(555) 123-4567"
          />
        </div>
        <label>
          Password
          <div className="auth-form__password-field">
            <input
              type={passwordVisible ? "text" : "password"}
              value={form.password}
              onChange={updateField("password")}
              autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            placeholder={PASSWORD_PLACEHOLDER}
            required
          />
            <button
              type="button"
              className="auth-form__reveal-password"
              aria-label="Hold to show password"
              onPointerDown={passwordReveal.onPointerDown}
              onPointerUp={passwordReveal.onPointerUp}
              onPointerCancel={passwordReveal.onPointerUp}
            >
              <Eye size={20} strokeWidth={2} aria-hidden />
            </button>
          </div>
        </label>
        <label>
          Confirm Password
          <div className="auth-form__password-field">
            <input
              type={passwordConfirmVisible ? "text" : "password"}
              value={passwordConfirm}
              onChange={(event) => setPasswordConfirm(event.target.value)}
              autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            placeholder={PASSWORD_PLACEHOLDER}
            required
          />
            <button
              type="button"
              className="auth-form__reveal-password"
              aria-label="Hold to show confirm password"
              onPointerDown={confirmPasswordReveal.onPointerDown}
              onPointerUp={confirmPasswordReveal.onPointerUp}
              onPointerCancel={confirmPasswordReveal.onPointerUp}
            >
              <Eye size={20} strokeWidth={2} aria-hidden />
            </button>
          </div>
        </label>
        {error && <p className="auth-form__error auth-form__wide">{error}</p>}
        <button
          className="auth-form__wide"
          type="submit"
          disabled={submitting || !canSubmit}
        >
          {submitting ? "Creating..." : "Create account"}
        </button>
      </form>
      <p className="auth-card__footer">
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </section>
  );
}
