"use client";

import { useState } from "react";
import { CheckCircle } from "@phosphor-icons/react";
import ImageUploadField from "@/components/admin/ImageUploadField";
import type { AboutContent } from "@/lib/supabase/types";

export default function AboutContentForm({ initial }: { initial: AboutContent }) {
  const [value, setValue] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/admin/content/about", {
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
      <h2 className="font-serif text-lg font-semibold text-ink">About Us</h2>

      <div className="mt-4 space-y-4">
        <div>
          <label className="text-sm font-medium text-ink/80">
            Body text (separate paragraphs with a blank line)
          </label>
          <textarea
            rows={8}
            value={value.body}
            onChange={(e) => {
              setValue({ ...value, body: e.target.value });
              setSaved(false);
            }}
            className="focus-ring mt-1.5 w-full rounded-lg border border-taupe/25 bg-page px-3.5 py-2.5 text-sm text-ink"
          />
        </div>
        <ImageUploadField
          label="About Us photo"
          currentUrl={value.image_url}
          path="about/main"
          onUploaded={(url) => {
            setValue({ ...value, image_url: url });
            setSaved(false);
          }}
          onRemove={() => {
            setValue({ ...value, image_url: null });
            setSaved(false);
          }}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <ImageUploadField
            label="Morning coffee corner photo"
            currentUrl={value.coffee_corner_image_url}
            path="about/coffee-corner"
            onUploaded={(url) => {
              setValue({ ...value, coffee_corner_image_url: url });
              setSaved(false);
            }}
            onRemove={() => {
              setValue({ ...value, coffee_corner_image_url: null });
              setSaved(false);
            }}
          />
          <ImageUploadField
            label="Quiet reading nook photo"
            currentUrl={value.reading_nook_image_url}
            path="about/reading-nook"
            onUploaded={(url) => {
              setValue({ ...value, reading_nook_image_url: url });
              setSaved(false);
            }}
            onRemove={() => {
              setValue({ ...value, reading_nook_image_url: null });
              setSaved(false);
            }}
          />
        </div>
      </div>

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
