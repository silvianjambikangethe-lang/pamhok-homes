"use client";

import { useRef, useState } from "react";
import { ArrowClockwise, CheckCircle } from "@phosphor-icons/react";
import StarRating from "@/components/StarRating";
import ThankYouGift, { type ThankYouGiftHandle } from "@/components/portal/ThankYouGift";
import CallaThankYouGift from "@/components/portal/CallaThankYouGift";

// 4.8 and 5.0 (the only ratings the 0.1-step slider can reach in that top
// sliver) get the full ThankYouGift bouquet, unchanged, with its replay
// button. 3.5-4.7 get a separate, much simpler calla-lilies gift (pops up,
// holds, shrinks away — no envelope, no platter, no replay). Below 3.5, no
// gift. Exported so CheckoutSection can keep its post-review refresh delay
// in sync with whichever gift (if any) is about to play.
export const GIFT_THRESHOLD = 4.8;
export const GIFT_LOW_THRESHOLD = 3.5;

// The form itself, without any card around it: ReviewPrompt supplies the
// card, the pop-up animation and the X to skip it.
export default function ReviewForm({
  token,
  onSubmitted,
}: {
  token: string;
  // Receives the submitted rating so a caller that refreshes the page
  // shortly after can wait out the thank-you gift animation instead of
  // cutting it off.
  onSubmitted?: (rating: number) => void;
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  // The replay button only makes sense once the gift has actually played
  // through and left the screen — showing it earlier would let a guest
  // "replay" something that hasn't happened yet.
  const [showReplay, setShowReplay] = useState(false);
  const giftRef = useRef<ThankYouGiftHandle>(null);

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
      onSubmitted?.(rating);
    } catch {
      setError("Could not save your review.");
      setSubmitting(false);
    }
  }

  if (done) {
    const fullGiftEarned = rating >= GIFT_THRESHOLD;
    const callaGiftEarned = !fullGiftEarned && rating >= GIFT_LOW_THRESHOLD;
    return (
      <div className="flex flex-col gap-2 pr-8 text-sm font-medium text-ink">
        <div className="flex items-center gap-2">
          <CheckCircle size={20} weight="fill" className="text-success" />
          Thank you for your review!
        </div>
        {fullGiftEarned && (
          <>
            <ThankYouGift ref={giftRef} onFinished={() => setShowReplay(true)} />
            {showReplay && (
              <button
                type="button"
                onClick={() => giftRef.current?.play()}
                className="focus-ring mt-1 flex w-fit items-center gap-1.5 rounded-full border border-taupe/25 px-3.5 py-1.5 text-xs font-medium text-ink/75 transition-colors hover:bg-page hover:text-ink"
              >
                <ArrowClockwise size={14} />
                Gift Replay
              </button>
            )}
          </>
        )}
        {callaGiftEarned && <CallaThankYouGift />}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="pr-8 font-serif text-h3 text-ink">
        How was your stay?
      </h2>

      <div className="mt-4 flex items-center justify-between gap-3">
        <StarRating rating={rating} size={28} />
        <p className="font-serif text-2xl font-semibold text-ink" aria-live="polite">
          {rating.toFixed(1)}
          <span className="text-sm font-normal text-ink/65"> / 5</span>
        </p>
      </div>

      {/* Drag (or tap the bar) to pick any value from 1.0 to 5.0 in tenths. */}
      <input
        type="range"
        min={1}
        max={5}
        step={0.1}
        value={rating}
        onChange={(e) => setRating(Number(e.target.value))}
        aria-label="Your rating out of 5"
        aria-valuetext={`${rating.toFixed(1)} out of 5`}
        className="focus-ring mt-3 block h-8 w-full cursor-pointer accent-[#B8814F]"
      />
      <div className="flex justify-between px-1 text-xs text-ink/65" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={4}
        maxLength={2000}
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
