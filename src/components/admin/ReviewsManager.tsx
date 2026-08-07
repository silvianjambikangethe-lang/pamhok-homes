"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Star, Trash, Warning } from "@phosphor-icons/react";
import type { Review } from "@/lib/supabase/types";

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5 text-gold-500" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={14} weight={i < rating ? "fill" : "regular"} />
      ))}
    </div>
  );
}

function ReviewRow({
  review,
  onFeaturedChange,
  onDeleted,
}: {
  review: Review;
  onFeaturedChange: (id: string, featured: boolean) => void;
  onDeleted: (id: string) => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleFeatured() {
    setBusy(true);
    setError(null);
    const next = !review.featured;

    const res = await fetch(`/api/admin/reviews/${review.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ featured: next }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not update review.");
      setBusy(false);
      return;
    }

    setBusy(false);
    onFeaturedChange(review.id, next);
  }

  async function handleDelete() {
    setBusy(true);
    setError(null);

    const res = await fetch(`/api/admin/reviews/${review.id}`, { method: "DELETE" });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not delete review.");
      setBusy(false);
      setConfirmingDelete(false);
      return;
    }

    onDeleted(review.id);
  }

  return (
    <div
      className={`rounded-2xl border p-5 shadow-card transition-colors ${
        review.featured
          ? "border-terracotta-500 bg-terracotta-50/40 dark:bg-terracotta-700/10"
          : "border-taupe/20 bg-surface"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <StarRow rating={review.rating} />
          <p className="mt-2 text-sm text-ink/80">
            {review.comment ?? <span className="italic text-ink/50">No comment left.</span>}
          </p>
          <p className="mt-2 text-xs text-ink/55">
            {review.guest_display_name ?? "Guest"} ·{" "}
            {format(parseISO(review.created_at), "d MMM yyyy")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={toggleFeatured}
            disabled={busy}
            className={`focus-ring flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold transition-colors disabled:opacity-60 ${
              review.featured
                ? "border-mocha-500 dark:border-terracotta-500 bg-mocha-500 dark:bg-terracotta-500 text-mousse dark:text-white hover:bg-mocha-600 dark:hover:bg-terracotta-600"
                : "border-taupe/25 text-ink/80 hover:border-terracotta-300"
            }`}
          >
            <Star size={14} weight={review.featured ? "fill" : "regular"} />
            {review.featured ? "Featured" : "Feature"}
          </button>
          {!confirmingDelete ? (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              disabled={busy}
              className="focus-ring rounded-full p-2 text-danger hover:bg-danger/10 disabled:opacity-60"
              aria-label="Delete review"
            >
              <Trash size={16} />
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy}
                className="focus-ring rounded-full bg-danger px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={busy}
                className="focus-ring rounded-full px-2 py-1.5 text-xs font-semibold text-ink/65 hover:text-ink"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-danger">
          <Warning size={14} /> {error}
        </p>
      )}
    </div>
  );
}

export default function ReviewsManager({ reviews: initialReviews }: { reviews: Review[] }) {
  const [reviews, setReviews] = useState(initialReviews);

  function handleFeaturedChange(id: string, featured: boolean) {
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, featured } : r)));
  }

  function handleDeleted(id: string) {
    setReviews((prev) => prev.filter((r) => r.id !== id));
  }

  if (reviews.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-taupe/40 bg-page p-6 text-center text-sm text-ink/65">
        No reviews yet — guests can leave one from their portal once checked out.
      </p>
    );
  }

  const featuredCount = reviews.filter((r) => r.featured).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink/65">
        {featuredCount} of {reviews.length} review{reviews.length === 1 ? "" : "s"} featured on
        the homepage.
      </p>
      {reviews.map((review) => (
        <ReviewRow
          key={review.id}
          review={review}
          onFeaturedChange={handleFeaturedChange}
          onDeleted={handleDeleted}
        />
      ))}
    </div>
  );
}
