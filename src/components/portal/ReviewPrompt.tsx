"use client";

import { useEffect, useState } from "react";
import { X } from "@phosphor-icons/react";
import ReviewForm from "@/components/portal/ReviewForm";

// Remembered per booking link so closing the card means "no review" and it
// doesn't come back on every visit. localStorage can be blocked (private
// mode), so a module-level set covers the rest of the current session.
const dismissedThisSession = new Set<string>();
const storageKey = (token: string) => `pamhok_review_dismissed_${token}`;

function wasDismissed(token: string) {
  if (dismissedThisSession.has(token)) return true;
  try {
    return localStorage.getItem(storageKey(token)) === "1";
  } catch {
    return false;
  }
}

// The review as a pop-up card with an X. Tapping the X skips the review.
export default function ReviewPrompt({
  token,
  onClose,
  onSubmitted,
}: {
  token: string;
  // Called after the X is tapped, once the choice has been remembered.
  onClose?: () => void;
  onSubmitted?: (rating: number) => void;
}) {
  // Hidden until we know they haven't already skipped it, so a guest who
  // closed it earlier never sees it flash back.
  const [state, setState] = useState<"checking" | "open" | "closed">("checking");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time storage read, not a render sync
    setState(wasDismissed(token) ? "closed" : "open");
  }, [token]);

  function close() {
    dismissedThisSession.add(token);
    try {
      localStorage.setItem(storageKey(token), "1");
    } catch {
      // Storage blocked: the in-memory set above still covers this session.
    }
    setState("closed");
    onClose?.();
  }

  if (state !== "open") return null;

  return (
    <div
      role="region"
      aria-label="Leave a review"
      className="review-pop relative rounded-2xl border border-taupe/20 bg-surface p-6 shadow-card"
    >
      <button
        type="button"
        onClick={close}
        aria-label="Close, no review"
        className="focus-ring absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-ink/65 transition-colors hover:bg-page hover:text-ink"
      >
        <X size={18} />
      </button>
      <ReviewForm token={token} onSubmitted={onSubmitted} />
    </div>
  );
}
