"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle } from "@phosphor-icons/react";

// Two-step on purpose: checking a guest out deletes their ID photos and
// phone number and emails them the review link — none of which can be
// undone, and the phone number is right there on the card to note first.
export default function MarkCheckedOutButton({
  bookingId,
  guestName,
}: {
  bookingId: string;
  guestName: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setBusy(true);
    setError(null);

    const res = await fetch(`/api/admin/bookings/${bookingId}/mark-checked-out`, {
      method: "POST",
    }).catch(() => null);

    if (!res || !res.ok) {
      const data = await res?.json().catch(() => null);
      setError(data?.error ?? "Could not mark as checked out.");
      setBusy(false);
      return;
    }

    setBusy(false);
    setConfirming(false);
    router.refresh();
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`Mark ${guestName} as checked out`}
        className="focus-ring flex items-center gap-2 rounded-full border border-forest-500 px-4 py-2 text-xs font-semibold text-forest-700 hover:bg-forest-500 hover:text-white dark:text-sage-300 dark:hover:bg-sage-500 dark:hover:text-espresso"
      >
        <CheckCircle size={16} />
        Mark checked out
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-ink/65">
        This deletes {guestName}&apos;s ID photos and phone number and emails them their review
        link. It can&apos;t be undone.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={busy}
          className="focus-ring rounded-full bg-forest-700 px-4 py-2 text-xs font-semibold text-white hover:bg-forest-900 disabled:opacity-50 dark:bg-sage-500 dark:text-espresso dark:hover:bg-sage-300"
        >
          {busy ? "Checking out…" : "Yes, check out"}
        </button>
        <button
          type="button"
          onClick={() => {
            setConfirming(false);
            setError(null);
          }}
          disabled={busy}
          className="focus-ring rounded text-xs font-semibold text-ink/65 hover:text-ink disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
