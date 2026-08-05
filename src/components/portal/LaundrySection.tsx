"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseISO, startOfDay } from "date-fns";
import { TShirt, Warning } from "@phosphor-icons/react";

const GUEST_LABELS: Record<string, string> = {
  Open: "Pickup Requested",
  "Picked Up": "In Progress",
  Cleaning: "In Progress",
  Ready: "Ready for Return",
  Returned: "Returned",
};

// "Returned" and "Closed" both mean this request cycle is done — the
// guest can start a fresh pickup request rather than being stuck looking
// at a finished one for the rest of their stay.
const ACTIVE_STAGES = new Set(["Open", "Picked Up", "Cleaning", "Ready"]);

export default function LaundrySection({
  token,
  checkIn,
  checkOut,
  initialStatus,
}: {
  token: string;
  checkIn: string;
  checkOut: string;
  initialStatus: string | null;
}) {
  const router = useRouter();
  const today = startOfDay(new Date());
  const isActiveStay = today >= startOfDay(parseISO(checkIn)) && today < startOfDay(parseISO(checkOut));

  const [status, setStatus] = useState(initialStatus);
  const [showForm, setShowForm] = useState(false);
  const [itemCount, setItemCount] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isActiveStay) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-gold-500/20 bg-page px-4 py-3 text-sm text-ink/65">
        <TShirt size={20} className="shrink-0 opacity-60" />
        Request Laundry Pickup — available once your stay begins.
      </div>
    );
  }

  const hasActiveRequest = status && ACTIVE_STAGES.has(status);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/portal/${token}/laundry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemCount, notes }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Could not send laundry request.");
        setSubmitting(false);
        return;
      }

      setStatus("Open");
      setShowForm(false);
      setSubmitting(false);
      router.refresh();
    } catch {
      setError("Could not send laundry request.");
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-gold-500/20 bg-page px-4 py-3">
      {hasActiveRequest ? (
        <div className="flex items-center gap-3 text-sm text-ink">
          <TShirt size={20} className="shrink-0 text-terracotta-600" />
          <span className="font-medium">Laundry: {GUEST_LABELS[status!] ?? status}</span>
        </div>
      ) : showForm ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="itemCount" className="text-sm font-medium text-ink/80">
              Roughly how many items or bags? (optional)
            </label>
            <input
              id="itemCount"
              value={itemCount}
              onChange={(e) => setItemCount(e.target.value)}
              placeholder="e.g. 1 bag"
              className="focus-ring mt-1.5 w-full rounded-lg border border-gold-500/25 bg-surface px-3 py-2 text-sm text-ink"
            />
          </div>
          <div>
            <label htmlFor="laundryNotes" className="text-sm font-medium text-ink/80">
              Notes (optional)
            </label>
            <textarea
              id="laundryNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="e.g. delicates, please wash cold"
              className="focus-ring mt-1.5 w-full rounded-lg border border-gold-500/25 bg-surface px-3 py-2 text-sm text-ink"
            />
          </div>
          {error && (
            <p role="alert" className="flex items-center gap-2 text-sm text-danger">
              <Warning size={16} /> {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="focus-ring rounded-full bg-terracotta-500 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-terracotta-600 disabled:opacity-60"
            >
              {submitting ? "Sending…" : "Request Pickup"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="focus-ring rounded-full px-5 py-2 text-sm font-semibold text-ink/65 hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="focus-ring flex items-center gap-2 text-sm font-semibold text-terracotta-600 hover:text-terracotta-700"
        >
          <TShirt size={20} />
          Request Laundry Pickup
        </button>
      )}
    </div>
  );
}
