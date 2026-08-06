"use client";

import { useState } from "react";
import { CheckCircle } from "@phosphor-icons/react";
import type { ContactContent } from "@/lib/supabase/types";

export default function ContactContentForm({ initial }: { initial: ContactContent }) {
  const [value, setValue] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/admin/content/contact", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not save changes.");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setSaved(true);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-gold-500/20 bg-surface p-6 shadow-card"
    >
      <h2 className="font-serif text-lg font-semibold text-ink">Contact & Location</h2>

      <div className="mt-4 space-y-4">
        <div>
          <label className="text-sm font-medium text-ink/80">Address line</label>
          <input
            type="text"
            value={value.address_text}
            onChange={(e) => {
              setValue({ ...value, address_text: e.target.value });
              setSaved(false);
            }}
            className="focus-ring mt-1.5 w-full rounded-lg border border-gold-500/25 bg-page px-3.5 py-2.5 text-sm text-ink"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-ink/80">Address note</label>
          <input
            type="text"
            value={value.address_note}
            onChange={(e) => {
              setValue({ ...value, address_note: e.target.value });
              setSaved(false);
            }}
            className="focus-ring mt-1.5 w-full rounded-lg border border-gold-500/25 bg-page px-3.5 py-2.5 text-sm text-ink"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-ink/80">Google Maps link</label>
          <input
            type="text"
            value={value.maps_url ?? ""}
            onChange={(e) => {
              setValue({ ...value, maps_url: e.target.value.trim() || null });
              setSaved(false);
            }}
            placeholder="https://maps.app.goo.gl/…"
            className="focus-ring mt-1.5 w-full rounded-lg border border-gold-500/25 bg-page px-3.5 py-2.5 text-sm text-ink"
          />
          <p className="mt-1 text-xs text-ink/65">
            Powers the &quot;Get Directions&quot; button on the Contact page
            and in the guest portal. Share a pin from Google Maps and paste
            the link here.
          </p>
        </div>
        <div>
          <label className="text-sm font-medium text-ink/80">Contact form intro line</label>
          <textarea
            rows={2}
            value={value.intro_line}
            onChange={(e) => {
              setValue({ ...value, intro_line: e.target.value });
              setSaved(false);
            }}
            className="focus-ring mt-1.5 w-full rounded-lg border border-gold-500/25 bg-page px-3.5 py-2.5 text-sm text-ink"
          />
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="focus-ring rounded-full bg-terracotta-500 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-terracotta-600 disabled:opacity-60"
        >
          {submitting ? "Saving…" : "Save Changes"}
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm font-medium text-success">
            <CheckCircle size={16} weight="fill" /> Saved
          </span>
        )}
      </div>
    </form>
  );
}
