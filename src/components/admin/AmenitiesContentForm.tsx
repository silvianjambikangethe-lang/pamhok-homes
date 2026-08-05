"use client";

import { useState } from "react";
import { CheckCircle, Plus, Trash } from "@phosphor-icons/react";
import { AMENITY_ICON_NAMES, getAmenityIcon } from "@/lib/amenity-icons";
import type { AmenityItem } from "@/lib/supabase/types";

const EMPTY_ITEM: AmenityItem = { title: "", description: "", icon: AMENITY_ICON_NAMES[0] };

export default function AmenitiesContentForm({ initial }: { initial: AmenityItem[] }) {
  const [items, setItems] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateItem(index: number, patch: Partial<AmenityItem>) {
    setItems(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
    setSaved(false);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
    setSaved(false);
  }

  function addItem() {
    setItems([...items, { ...EMPTY_ITEM }]);
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/admin/content/amenities", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: items }),
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
      <h2 className="font-serif text-lg font-semibold text-ink">Amenities</h2>
      <p className="mt-1 text-xs text-ink/65">
        The first 5 also appear as a preview on the homepage.
      </p>

      <div className="mt-4 space-y-4">
        {items.map((item, index) => {
          const Icon = getAmenityIcon(item.icon);
          return (
            <div
              key={index}
              className="rounded-xl border border-gold-500/20 bg-page p-4"
            >
              <div className="flex items-start gap-3">
                <Icon size={22} className="mt-2 shrink-0 text-terracotta-600" />
                <div className="grid flex-1 gap-3 sm:grid-cols-[auto_1fr]">
                  <select
                    value={item.icon}
                    onChange={(e) => updateItem(index, { icon: e.target.value })}
                    className="focus-ring rounded-lg border border-gold-500/25 bg-surface px-2.5 py-2 text-sm text-ink"
                  >
                    {AMENITY_ICON_NAMES.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={item.title}
                    placeholder="Title"
                    onChange={(e) => updateItem(index, { title: e.target.value })}
                    className="focus-ring rounded-lg border border-gold-500/25 bg-surface px-3 py-2 text-sm text-ink"
                  />
                  <textarea
                    rows={2}
                    value={item.description}
                    placeholder="Description"
                    onChange={(e) => updateItem(index, { description: e.target.value })}
                    className="focus-ring col-span-full rounded-lg border border-gold-500/25 bg-surface px-3 py-2 text-sm text-ink"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="focus-ring shrink-0 rounded-full p-2 text-danger hover:bg-danger/10"
                  aria-label="Remove amenity"
                >
                  <Trash size={18} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={addItem}
        className="focus-ring mt-4 flex items-center gap-1.5 rounded-full border border-gold-500/25 px-4 py-2 text-xs font-semibold text-ink/80 hover:border-terracotta-300"
      >
        <Plus size={14} /> Add Item
      </button>

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
