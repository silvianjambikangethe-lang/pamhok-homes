"use client";

import { useState } from "react";
import { CheckCircle } from "@phosphor-icons/react";

// No "current password" field — the host isn't confirming their own
// password here, they're editing a different (shared) account. Being
// logged in as an admin at all is already the gate (enforced server-side
// via admin_users RLS membership, not just this page being inside the
// dashboard).
export default function StaffCredentialsForm({ currentEmail }: { currentEmail: string }) {
  const [email, setEmail] = useState(currentEmail);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);

    const body: { email?: string; password?: string } = {};
    if (email.trim() && email.trim() !== currentEmail) body.email = email.trim();
    if (password) body.password = password;

    if (!body.email && !body.password) {
      setSubmitting(false);
      setError("Change the email or set a new password first.");
      return;
    }

    const res = await fetch("/api/admin/staff-credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not update staff login.");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setSaved(true);
    setPassword("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-taupe/20 bg-surface p-6 shadow-warm sm:p-8"
    >
      <h2 className="font-serif text-lg font-semibold text-ink">Staff Login</h2>
      <p className="mt-1 text-sm text-ink/70">
        One shared login every worker uses at /staff/login. Changing the password here signs out
        every device currently using it.
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="staffEmail" className="text-sm font-medium text-ink/80">
            Email
          </label>
          <input
            id="staffEmail"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="focus-ring mt-1.5 w-full rounded-lg border border-taupe/25 bg-page px-3.5 py-2.5 text-sm text-ink"
          />
        </div>
        <div>
          <label htmlFor="staffPassword" className="text-sm font-medium text-ink/80">
            New Password
          </label>
          <input
            id="staffPassword"
            type="password"
            minLength={8}
            autoComplete="new-password"
            placeholder="Leave blank to keep the current password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="focus-ring mt-1.5 w-full rounded-lg border border-taupe/25 bg-page px-3.5 py-2.5 text-sm text-ink"
          />
          <p className="mt-1 text-xs text-ink/55">At least 8 characters.</p>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="focus-ring rounded-full bg-mocha-500 dark:bg-terracotta-500 px-6 py-2.5 text-sm font-semibold text-mousse dark:text-white transition-colors hover:bg-mocha-600 dark:hover:bg-terracotta-600 disabled:opacity-60"
        >
          {submitting ? "Updating…" : "Update Staff Login"}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm font-medium text-success">
            <CheckCircle size={16} weight="fill" /> Updated.
          </span>
        )}
      </div>
    </form>
  );
}
