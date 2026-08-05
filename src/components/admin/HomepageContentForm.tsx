"use client";

import { useState } from "react";
import { CheckCircle } from "@phosphor-icons/react";
import ImageUploadField from "@/components/admin/ImageUploadField";
import type { HomepageContent } from "@/lib/supabase/types";

export default function HomepageContentForm({ initial }: { initial: HomepageContent }) {
  const [value, setValue] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/admin/content/homepage", {
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
      <h2 className="font-serif text-lg font-semibold text-ink">Homepage</h2>

      <div className="mt-4 space-y-4">
        <div>
          <label className="text-sm font-medium text-ink/80">Eyebrow label</label>
          <input
            type="text"
            value={value.eyebrow}
            onChange={(e) => {
              setValue({ ...value, eyebrow: e.target.value });
              setSaved(false);
            }}
            className="focus-ring mt-1.5 w-full rounded-lg border border-gold-500/25 bg-page px-3.5 py-2.5 text-sm text-ink"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-ink/80">Headline</label>
          <input
            type="text"
            value={value.headline}
            onChange={(e) => {
              setValue({ ...value, headline: e.target.value });
              setSaved(false);
            }}
            className="focus-ring mt-1.5 w-full rounded-lg border border-gold-500/25 bg-page px-3.5 py-2.5 text-sm text-ink"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-ink/80">Subtext</label>
          <textarea
            rows={2}
            value={value.subtext}
            onChange={(e) => {
              setValue({ ...value, subtext: e.target.value });
              setSaved(false);
            }}
            className="focus-ring mt-1.5 w-full rounded-lg border border-gold-500/25 bg-page px-3.5 py-2.5 text-sm text-ink"
          />
        </div>
        <ImageUploadField
          label="Hero image (optional — falls back to a plain color background if empty)"
          currentUrl={value.hero_image_url}
          path="homepage/hero"
          onUploaded={(url) => {
            setValue({ ...value, hero_image_url: url });
            setSaved(false);
          }}
          onRemove={() => {
            setValue({ ...value, hero_image_url: null });
            setSaved(false);
          }}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <ImageUploadField
            label="Living room photo"
            currentUrl={value.living_room_image_url}
            path="homepage/living-room"
            onUploaded={(url) => {
              setValue({ ...value, living_room_image_url: url });
              setSaved(false);
            }}
            onRemove={() => {
              setValue({ ...value, living_room_image_url: null });
              setSaved(false);
            }}
          />
          <ImageUploadField
            label="Bedroom photo"
            currentUrl={value.bedroom_image_url}
            path="homepage/bedroom"
            onUploaded={(url) => {
              setValue({ ...value, bedroom_image_url: url });
              setSaved(false);
            }}
            onRemove={() => {
              setValue({ ...value, bedroom_image_url: null });
              setSaved(false);
            }}
          />
          <ImageUploadField
            label="Kitchen photo"
            currentUrl={value.kitchen_image_url}
            path="homepage/kitchen"
            onUploaded={(url) => {
              setValue({ ...value, kitchen_image_url: url });
              setSaved(false);
            }}
            onRemove={() => {
              setValue({ ...value, kitchen_image_url: null });
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
