"use client";

import { useState } from "react";
import { CheckCircle, Warning } from "@phosphor-icons/react";
import type { SiteStatus } from "@/lib/supabase/types";

export default function SiteStatusForm({ initial }: { initial: SiteStatus }) {
  const [isOpen, setIsOpen] = useState(initial.is_open);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function setStatus(nextIsOpen: boolean) {
    setSubmitting(true);
    setError(null);
    setSaved(false);
    setConfirming(false);

    const res = await fetch("/api/admin/content/site_status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: { is_open: nextIsOpen } }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not update site status.");
      setSubmitting(false);
      return;
    }

    setIsOpen(nextIsOpen);
    setSubmitting(false);
    setSaved(true);
  }

  return (
    <div
      className={`rounded-2xl border-2 p-6 shadow-card ${
        isOpen ? "border-taupe/20 bg-surface" : "border-danger/40 bg-danger/5"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${isOpen ? "bg-success" : "bg-danger"}`}
        />
        <h2 className="font-serif text-lg font-semibold text-ink">
          Site Status: {isOpen ? "Open" : "Closed"}
        </h2>
      </div>
      <p className="mt-1 text-xs text-ink/65">
        Closing the site shows every visitor a &quot;temporarily closed&quot;
        message with your contact details instead of the normal pages —
        homepage, rooms, about, contact, everything guests would browse.
        Current guests can still reach their own portal (door code, WiFi,
        requests), and this admin dashboard stays fully usable so you can
        reopen whenever you&apos;re ready.
      </p>

      <div className="mt-4">
        {isOpen ? (
          !confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              disabled={submitting}
              className="focus-ring rounded-full border border-danger/40 px-6 py-2.5 text-sm font-semibold text-danger transition-colors hover:bg-danger/10 disabled:opacity-60"
            >
              Shut Down Website
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-danger/40 bg-danger/10 p-4">
              <Warning size={20} className="shrink-0 text-danger" />
              <p className="flex-1 text-sm text-ink">
                This immediately hides the site from every visitor. Are you sure?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStatus(false)}
                  disabled={submitting}
                  className="focus-ring rounded-full bg-danger px-4 py-2 text-xs font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-60"
                >
                  {submitting ? "Shutting down…" : "Yes, shut it down"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={submitting}
                  className="focus-ring rounded-full px-4 py-2 text-xs font-semibold text-ink/65 hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            </div>
          )
        ) : (
          <button
            type="button"
            onClick={() => setStatus(true)}
            disabled={submitting}
            className="focus-ring rounded-full bg-mocha-500 dark:bg-terracotta-500 px-6 py-2.5 text-sm font-semibold text-mousse dark:text-white transition-colors hover:bg-mocha-600 dark:hover:bg-terracotta-600 disabled:opacity-60"
          >
            {submitting ? "Reopening…" : "Reopen Website"}
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      {saved && (
        <span className="mt-3 flex items-center gap-1.5 text-sm font-medium text-success">
          <CheckCircle size={16} weight="fill" />
          {isOpen ? "Site is live again." : "Site is now closed to visitors."}
        </span>
      )}
    </div>
  );
}
