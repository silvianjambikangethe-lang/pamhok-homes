"use client";

import { useState } from "react";
import { CheckCircle, Plus, Trash } from "@phosphor-icons/react";
import ImageUploadField from "@/components/admin/ImageUploadField";
import MapsLinkField from "@/components/admin/MapsLinkField";
import type { NeighborhoodContent, NeighborhoodItem } from "@/lib/supabase/types";

const EMPTY_ITEM: NeighborhoodItem = {
  name: "",
  detail: "",
  photo_url: null,
  maps_url: null,
  lat: null,
  lng: null,
};

function CategoryEditor({
  title,
  categoryKey,
  items,
  onChange,
}: {
  title: string;
  categoryKey: "food" | "recreation";
  items: NeighborhoodItem[];
  onChange: (items: NeighborhoodItem[]) => void;
}) {
  function updateItem(index: number, patch: Partial<NeighborhoodItem>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function addItem() {
    onChange([...items, { ...EMPTY_ITEM }]);
  }

  return (
    <div>
      <h3 className="font-serif text-base font-semibold text-ink">{title}</h3>
      <div className="mt-3 space-y-4">
        {items.map((item, index) => (
          <div
            key={index}
            className="rounded-xl border border-gold-500/20 bg-page p-4"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-ink/80">Name</label>
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => updateItem(index, { name: e.target.value })}
                  placeholder="e.g. Artcaffe"
                  className="focus-ring mt-1.5 w-full rounded-lg border border-gold-500/25 bg-surface px-3 py-2 text-sm text-ink"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-ink/80">Detail</label>
                <input
                  type="text"
                  value={item.detail}
                  onChange={(e) => updateItem(index, { detail: e.target.value })}
                  placeholder="e.g. 5 min drive, great for breakfast"
                  className="focus-ring mt-1.5 w-full rounded-lg border border-gold-500/25 bg-surface px-3 py-2 text-sm text-ink"
                />
              </div>
            </div>
            <div className="mt-3">
              <MapsLinkField
                label="Google Maps link (optional)"
                value={{ maps_url: item.maps_url, lat: item.lat, lng: item.lng }}
                onChange={({ maps_url, lat, lng }) => updateItem(index, { maps_url, lat, lng })}
                inputBg="bg-surface"
              />
              <p className="mt-1 text-xs text-ink/65">
                Adds a &quot;Get Directions from Pamhok Homes&quot; button for
                this place on the public page.
              </p>
            </div>
            <div className="mt-3 flex items-end justify-between gap-3">
              <ImageUploadField
                label="Photo"
                currentUrl={item.photo_url}
                path={`neighborhood/${categoryKey}-${index}`}
                onUploaded={(url) => updateItem(index, { photo_url: url })}
                onRemove={() => updateItem(index, { photo_url: null })}
              />
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="focus-ring shrink-0 rounded-full p-2 text-danger hover:bg-danger/10"
                aria-label={`Remove ${item.name || "location"}`}
              >
                <Trash size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addItem}
        className="focus-ring mt-3 flex items-center gap-1.5 rounded-full border border-gold-500/25 px-4 py-2 text-xs font-semibold text-ink/80 hover:border-terracotta-300"
      >
        <Plus size={14} /> Add {title === "Food" ? "Place" : "Location"}
      </button>
    </div>
  );
}

export default function NeighborhoodContentForm({
  initial,
}: {
  initial: NeighborhoodContent;
}) {
  const [value, setValue] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/admin/content/neighborhood", {
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
      <h2 className="font-serif text-lg font-semibold text-ink">Neighborhood</h2>
      <p className="mt-1 text-xs text-ink/65">
        Suggested places to eat and things to do near Pamhok Homes — shown on
        the public Neighborhood page.
      </p>

      <div className="mt-5 space-y-8">
        <CategoryEditor
          title="Food"
          categoryKey="food"
          items={value.food}
          onChange={(food) => {
            setValue({ ...value, food });
            setSaved(false);
          }}
        />
        <CategoryEditor
          title="Recreation"
          categoryKey="recreation"
          items={value.recreation}
          onChange={(recreation) => {
            setValue({ ...value, recreation });
            setSaved(false);
          }}
        />
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <div className="mt-5 flex items-center gap-3">
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
