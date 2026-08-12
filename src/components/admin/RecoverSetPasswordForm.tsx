"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RecoverSetPasswordForm() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/admin/recover/set-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword, confirmNewPassword }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not update password.");
      setSubmitting(false);
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-taupe/20 bg-surface p-6 shadow-warm sm:p-8"
    >
      <h2 className="font-serif text-lg font-semibold text-ink">Set a New Password</h2>
      <p className="mt-1 text-sm text-ink/70">
        You&apos;re verified via the emailed reset link, so no current password is needed.
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="newPassword" className="text-sm font-medium text-ink/80">
            New Password
          </label>
          <input
            id="newPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="focus-ring mt-1.5 w-full rounded-lg border border-taupe/25 bg-page px-3.5 py-2.5 text-sm text-ink"
          />
          <p className="mt-1 text-xs text-ink/55">At least 8 characters.</p>
        </div>
        <div>
          <label htmlFor="confirmNewPassword" className="text-sm font-medium text-ink/80">
            Confirm New Password
          </label>
          <input
            id="confirmNewPassword"
            type="password"
            required
            autoComplete="new-password"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            className="focus-ring mt-1.5 w-full rounded-lg border border-taupe/25 bg-page px-3.5 py-2.5 text-sm text-ink"
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="mt-5">
        <button
          type="submit"
          disabled={submitting}
          className="focus-ring rounded-full bg-mocha-500 dark:bg-terracotta-500 px-6 py-2.5 text-sm font-semibold text-mousse dark:text-white transition-colors hover:bg-mocha-600 dark:hover:bg-terracotta-600 disabled:opacity-60"
        >
          {submitting ? "Updating…" : "Set Password & Continue"}
        </button>
      </div>
    </form>
  );
}
