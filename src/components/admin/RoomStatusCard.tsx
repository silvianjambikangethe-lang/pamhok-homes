"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Phone, User, Warning } from "@phosphor-icons/react";
import { CHECK_OUT_TIME } from "@/lib/site";

export type RoomStatus = {
  id: string;
  name: string;
  bookingId: string | null;
  guestName: string | null;
  guestPhone: string | null;
  checkOut: string | null;
};

// Stale = checkout time (10:00 AM) plus a 30-minute grace period has
// passed on the checkout date, and the guest still hasn't confirmed
// checkout. Computed from the admin's own clock at render time.
function isStaleCheckout(checkOut: string, now: Date): boolean {
  const threshold = parseISO(checkOut);
  threshold.setHours(10, 30, 0, 0);
  return now >= threshold;
}

export default function RoomStatusCard({ room }: { room: RoomStatus }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stale =
    room.guestName && room.checkOut && isStaleCheckout(room.checkOut, new Date());

  async function handleDelete() {
    if (!room.bookingId) return;
    setDeleting(true);
    setError(null);

    const res = await fetch(`/api/admin/bookings/${room.bookingId}/cancel`, {
      method: "POST",
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not free up the room.");
      setDeleting(false);
      return;
    }

    router.refresh();
  }

  return (
    <div
      className={`rounded-2xl border p-5 shadow-card ${
        stale
          ? "border-danger/50 bg-danger/5"
          : room.guestName
            ? "border-terracotta-500/40 bg-surface"
            : "border-taupe/20 bg-page"
      }`}
    >
      <p className="font-serif text-h3 text-ink">{room.name}</p>
      {room.guestName ? (
        <div className="mt-3 space-y-1.5 text-sm">
          <p className="flex items-center gap-2 text-ink/80">
            <User size={16} className="shrink-0 text-terracotta-600" />
            {room.guestName}
          </p>
          {room.guestPhone && (
            <a
              href={`tel:${room.guestPhone}`}
              className="focus-ring flex items-center gap-2 rounded text-ink/80 hover:text-terracotta-600"
            >
              <Phone size={16} className="shrink-0 text-terracotta-600" />
              {room.guestPhone}
            </a>
          )}
          {room.checkOut && (
            <p className="text-xs text-ink/55">
              Checkout {format(new Date(room.checkOut), "d MMM")}, {CHECK_OUT_TIME}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink/55">Available</p>
      )}

      {stale && (
        <div className="mt-4 border-t border-danger/30 pt-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-danger">
            <Warning size={14} weight="fill" />
            Checkout not confirmed
          </p>
          {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="focus-ring mt-2 rounded-full border border-danger/40 px-3.5 py-1.5 text-xs font-semibold text-danger hover:bg-danger/10"
            >
              Free up room
            </button>
          ) : (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-ink/80">
                Confirm the guest has actually left — this removes the
                reservation and frees the room for new bookings.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="focus-ring rounded-full bg-danger px-3.5 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                >
                  {deleting ? "Freeing up…" : "Yes, free it up"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={deleting}
                  className="focus-ring rounded-full border border-taupe/25 px-3.5 py-1.5 text-xs font-semibold text-ink/80 hover:border-terracotta-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
