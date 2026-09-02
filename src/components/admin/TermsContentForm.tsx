"use client";

import { useState } from "react";
import { CheckCircle, Plus, Trash } from "@phosphor-icons/react";
import type { TermsContent, TermsSection } from "@/lib/supabase/types";

const EMPTY_SECTION: TermsSection = { title: "", body: "" };

export default function TermsContentForm({ initial }: { initial: TermsContent }) {
  const [value, setValue] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateSection(index: number, patch: Partial<TermsSection>) {
    setValue((v) => ({
      ...v,
      sections: v.sections.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
    setSaved(false);
  }

  function removeSection(index: number) {
    setValue((v) => ({ ...v, sections: v.sections.filter((_, i) => i !== index) }));
    setSaved(false);
  }

  function addSection() {
    setValue((v) => ({ ...v, sections: [...v.sections, { ...EMPTY_SECTION }] }));
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/admin/content/terms", {
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
      className="rounded-2xl border border-taupe/20 bg-surface p-6 shadow-card"
    >
      <h2 className="font-serif text-lg font-semibold text-ink">Terms & Conditions</h2>
      <p className="mt-1 text-xs text-ink/65">
        Shown on the public /terms page, and linked from every booking and payment step.
        Each section's text: start a line with &quot;- &quot; for a bullet point, and wrap
        text in **double asterisks** to bold it.
      </p>

      <div className="mt-4">
        <label className="text-sm font-medium text-ink/80">Last updated</label>
        <input
          type="text"
          value={value.last_updated}
          placeholder="e.g. 4 August 2026"
          onChange={(e) => {
            setValue((v) => ({ ...v, last_updated: e.target.value }));
            setSaved(false);
          }}
          className="focus-ring mt-1.5 w-full max-w-xs rounded-lg border border-taupe/25 bg-page px-3.5 py-2.5 text-sm text-ink"
        />
      </div>

      <div className="mt-5 space-y-4">
        {value.sections.map((section, index) => (
          <div key={index} className="rounded-xl border border-taupe/20 bg-page p-4">
            <div className="flex items-start gap-3">
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  value={section.title}
                  placeholder="Section title, e.g. 1. Booking & Payment"
                  onChange={(e) => updateSection(index, { title: e.target.value })}
                  className="focus-ring w-full rounded-lg border border-taupe/25 bg-surface px-3 py-2 text-sm font-semibold text-ink"
                />
                <textarea
                  rows={4}
                  value={section.body}
                  placeholder="Section text…"
                  onChange={(e) => updateSection(index, { body: e.target.value })}
                  className="focus-ring w-full rounded-lg border border-taupe/25 bg-surface px-3 py-2 text-sm text-ink"
                />
              </div>
              <button
                type="button"
                onClick={() => removeSection(index)}
                className="focus-ring shrink-0 rounded-full p-2 text-danger hover:bg-danger/10"
                aria-label="Remove section"
              >
                <Trash size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addSection}
        className="focus-ring mt-4 flex items-center gap-1.5 rounded-full border border-taupe/25 px-4 py-2 text-xs font-semibold text-ink/80 hover:border-terracotta-300"
      >
        <Plus size={14} /> Add Section
      </button>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="focus-ring rounded-full bg-mocha-500 dark:bg-terracotta-500 px-6 py-2.5 text-sm font-semibold text-mousse dark:text-white transition-colors hover:bg-mocha-600 dark:hover:bg-terracotta-600 disabled:opacity-60"
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
