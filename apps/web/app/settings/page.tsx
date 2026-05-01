"use client";

import { useEffect, useState } from "react";

import { getCurrentUser, updateCurrentUser } from "@/lib/api/auth-client";

export default function SettingsPage() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
  });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getCurrentUser().then((currentUser) => {
      setForm({
        firstName: currentUser.first_name,
        lastName: currentUser.last_name,
        phone: currentUser.phone ?? "",
        email: currentUser.email,
      });
    });
  }, []);

  const updateField =
    (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
    };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const updated = await updateCurrentUser({
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone.trim() || null,
      });
      setForm((current) => ({
        ...current,
        firstName: updated.first_name,
        lastName: updated.last_name,
        phone: updated.phone ?? "",
        email: updated.email,
      }));
      setFeedback("Profile updated.");
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Unable to update profile");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="dashboard-content">
      <header className="dashboard-content__header">
        <h2>Settings</h2>
      </header>
      <div className="settings-panel">
        <h3 id="profile-settings" className="settings-panel__subtitle">
          Profile Settings
        </h3>
        <form
          className="auth-form auth-form--dashboard auth-form--settings-grid"
          onSubmit={handleSubmit}
        >
          <label>
            First name
            <input value={form.firstName} onChange={updateField("firstName")} required />
          </label>
          <label>
            Last name
            <input value={form.lastName} onChange={updateField("lastName")} required />
          </label>
          <label>
            Phone
            <input value={form.phone} onChange={updateField("phone")} />
          </label>
          <label>
            Email
            <input type="email" value={form.email} disabled readOnly autoComplete="email" />
          </label>
          {feedback && <p className="auth-form__error auth-form__wide">{feedback}</p>}
          <button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Save profile"}
          </button>
        </form>
      </div>
    </section>
  );
}
