"use client";

import { useState } from "react";
import { CheckCircle } from "@phosphor-icons/react";

export default function ChangePhoneForm() {
  const [currentPhone, setCurrentPhone] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/admin/settings/phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPhone, newPhone }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not update phone number.");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setSaved(true);
    setCurrentPhone("");
    setNewPhone("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-taupe/20 bg-surface p-6 shadow-warm sm:p-8"
    >
      <h2 className="font-serif text-lg font-semibold text-ink">Change WhatsApp Phone Number</h2>
      <p className="mt-1 text-sm text-ink/70">
        This is the number guests reach you on through the &quot;Contact Host&quot; button on the
        site and guest portal.
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <label htmlFor="currentPhone" className="text-sm font-medium text-ink/80">
            Current Phone Number
          </label>
          <input
            id="currentPhone"
            type="tel"
            required
            value={currentPhone}
            onChange={(e) => setCurrentPhone(e.target.value)}
            placeholder="+254 7XX XXX XXX"
            className="focus-ring mt-1.5 w-full rounded-lg border border-taupe/25 bg-page px-3.5 py-2.5 text-sm text-ink"
          />
        </div>
        <div>
          <label htmlFor="newPhone" className="text-sm font-medium text-ink/80">
            New Phone Number
          </label>
          <input
            id="newPhone"
            type="tel"
            required
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            placeholder="+254 7XX XXX XXX"
            className="focus-ring mt-1.5 w-full rounded-lg border border-taupe/25 bg-page px-3.5 py-2.5 text-sm text-ink"
          />
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
          {submitting ? "Updating…" : "Update Phone Number"}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm font-medium text-success">
            <CheckCircle size={16} weight="fill" /> Number updated.
          </span>
        )}
      </div>
    </form>
  );
}
