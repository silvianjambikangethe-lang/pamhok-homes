"use client";

import { useState } from "react";
import { CheckCircle, Star } from "@phosphor-icons/react";

export default function ReviewForm({ token }: { token: string }) {
  const [rating, setRating] = useState(5);
  const [hovered, setHovered] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/portal/${token}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Could not save your review.");
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Could not save your review.");
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-taupe/20 bg-surface p-6 text-sm font-medium text-ink shadow-card">
        <CheckCircle size={20} weight="fill" className="text-success" />
        Thank you for your review!
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-taupe/20 bg-surface p-6 shadow-card"
    >
      <h2 className="font-serif text-h3 text-ink">
        How was your stay?
      </h2>
      <div className="mt-3 flex gap-1">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            aria-label={`${value} star${value > 1 ? "s" : ""}`}
            onClick={() => setRating(value)}
            onMouseEnter={() => setHovered(value)}
            onMouseLeave={() => setHovered(null)}
            className="focus-ring rounded"
          >
            <Star
              size={28}
              weight={(hovered ?? rating) >= value ? "fill" : "regular"}
              className="text-gold-500"
            />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={4}
        placeholder="Tell future guests about your stay…"
        className="focus-ring mt-4 w-full rounded-lg border border-taupe/25 bg-page px-3.5 py-2.5 text-sm text-ink"
      />
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="focus-ring mt-4 rounded-full bg-mocha-500 dark:bg-terracotta-500 px-6 py-2.5 text-sm font-semibold text-mousse dark:text-white transition-colors hover:bg-mocha-600 dark:hover:bg-terracotta-600 disabled:opacity-60"
      >
        {submitting ? "Sending…" : "Submit Review"}
      </button>
    </form>
  );
}
