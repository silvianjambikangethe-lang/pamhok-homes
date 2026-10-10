"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Lock, Phone, User, Warning, X } from "@phosphor-icons/react";
import { CHECK_OUT_TIME } from "@/lib/site";

export type RoomStatus = {
  id: string;
  name: string;
  bookingId: string | null;
  guestName: string | null;
  guestPhone: string | null;
  checkIn: string | null;
  checkOut: string | null;
  bookingReference: string | null;
  // Second guest sharing this room (a room sleeps up to 2) — display-only.
  secondGuestName: string | null;
  secondGuestPhone: string | null;
  // A host-blocked room (see BlockDatesForm) — mutually exclusive with an
  // active guest stay above; availability_view never lets both exist for
  // the same room on the same day.
  blockNote: string | null;
  blockStartAt: string | null;
  blockEndAt: string | null;
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
  const [showDetails, setShowDetails] = useState(false);
  const [confirmingRelease, setConfirmingRelease] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [releaseError, setReleaseError] = useState<string | null>(null);

  // A block has no guest attached, but still has a bookingId (the Blocked
  // row itself) — that's what tells a block apart from "Available".
  const isBlocked = Boolean(room.bookingId) && !room.guestName;
  // Only a block given a precise end time (see BlockDatesForm's optional
  // Start/End time fields) can ever flag this way — a plain whole-day block
  // has no defined end to compare against "now".
  const blockEnded = room.blockEndAt ? new Date() >= parseISO(room.blockEndAt) : false;

  const staleCheckout =
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

  // Releasing a block uses the exact same mechanism as freeing up a stale
  // checkout — cancelling the booking row (here, the Blocked one) drops it
  // out of availability_view and the room is bookable again.
  async function handleRelease() {
    if (!room.bookingId) return;
    setReleasing(true);
    setReleaseError(null);

    const res = await fetch(`/api/admin/bookings/${room.bookingId}/cancel`, {
      method: "POST",
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setReleaseError(data?.error ?? "Could not release the room.");
      setReleasing(false);
      return;
    }

    router.refresh();
  }

  return (
    <>
      <div
        className={`rounded-2xl border p-5 shadow-card ${
          staleCheckout || blockEnded
            ? "border-danger/50 bg-danger/5"
            : room.guestName || isBlocked
              ? "border-terracotta-500/40 bg-surface"
              : "border-taupe/20 bg-page"
        }`}
      >
        <p className="font-serif text-h3 text-ink">{room.name}</p>

        {room.guestName ? (
          <button
            type="button"
            onClick={() => setShowDetails(true)}
            className="focus-ring -mx-1 mt-3 w-[calc(100%+0.5rem)] rounded-xl px-1 py-1 text-left transition-colors hover:bg-page"
          >
            <div className="space-y-1.5 text-sm">
              <p className="flex items-center gap-2 text-ink/80">
                <User size={16} className="shrink-0 text-terracotta-600" />
                {room.guestName}
                {room.secondGuestName && ` + ${room.secondGuestName}`}
              </p>
              {room.guestPhone && (
                <p className="flex items-center gap-2 text-ink/80">
                  <Phone size={16} className="shrink-0 text-terracotta-600" />
                  {room.guestPhone}
                </p>
              )}
              {room.checkOut && (
                <p className="text-xs text-ink/55">
                  Checkout {format(new Date(room.checkOut), "d MMM")}, {CHECK_OUT_TIME}
                </p>
              )}
            </div>
            <span className="mt-1.5 inline-block text-xs font-semibold text-terracotta-600">
              View guest details →
            </span>
          </button>
        ) : isBlocked ? (
          <div className="mt-3 space-y-1.5 text-sm">
            <p className="flex items-center gap-2 font-semibold text-ink/80">
              <Lock size={16} className="shrink-0 text-terracotta-600" />
              Blocked
            </p>
            {room.blockNote && <p className="text-ink/70">{room.blockNote}</p>}
            {room.blockStartAt && room.blockEndAt ? (
              <p className="text-xs text-ink/55">
                {format(parseISO(room.blockStartAt), "d MMM, h:mm a")} –{" "}
                {format(parseISO(room.blockEndAt), "d MMM, h:mm a")}
              </p>
            ) : (
              <p className="text-xs text-ink/55">Blocked for the day</p>
            )}
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink/55">Available</p>
        )}

        {staleCheckout && (
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
                  Confirm the guest has actually left, this removes the
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

        {isBlocked && (
          <div
            className={`mt-4 border-t pt-3 ${blockEnded ? "border-danger/30" : "border-taupe/20"}`}
          >
            {blockEnded && (
              <p className="flex items-center gap-1.5 text-xs font-semibold text-danger">
                <Warning size={14} weight="fill" />
                Block time is up
              </p>
            )}
            {releaseError && <p className="mt-1.5 text-xs text-danger">{releaseError}</p>}
            {!confirmingRelease ? (
              <button
                type="button"
                onClick={() => setConfirmingRelease(true)}
                className={`focus-ring mt-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold ${
                  blockEnded
                    ? "border-danger/40 text-danger hover:bg-danger/10"
                    : "border-taupe/25 text-ink/80 hover:border-terracotta-300"
                }`}
              >
                {blockEnded ? "Confirm release" : "Release room"}
              </button>
            ) : (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-ink/80">
                  Confirm the room is actually ready — this removes the
                  block and frees it for new bookings.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleRelease}
                    disabled={releasing}
                    className="focus-ring rounded-full bg-danger px-3.5 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                  >
                    {releasing ? "Releasing…" : "Yes, release it"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingRelease(false)}
                    disabled={releasing}
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

      {showDetails && room.guestName && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Guest details for ${room.name}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/60 p-4"
          onClick={() => setShowDetails(false)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border-2 border-terracotta-500 bg-surface p-6 shadow-warm"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowDetails(false)}
              aria-label="Close"
              className="focus-ring absolute right-4 top-4 rounded-full p-1.5 text-ink/65 hover:bg-page hover:text-ink"
            >
              <X size={18} />
            </button>

            <p className="font-serif text-h3 text-ink">{room.name}</p>
            {room.bookingReference && (
              <p className="mt-1 text-xs text-ink/55">Ref: {room.bookingReference}</p>
            )}

            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-taupe/20 bg-page p-3.5">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink/55">
                  Guest 1
                </p>
                <p className="mt-1 flex items-center gap-2 text-sm text-ink">
                  <User size={16} className="shrink-0 text-terracotta-600" />
                  {room.guestName}
                </p>
                {room.guestPhone && (
                  <a
                    href={`tel:${room.guestPhone}`}
                    className="focus-ring mt-1 flex items-center gap-2 rounded text-sm text-ink/80 hover:text-terracotta-600"
                  >
                    <Phone size={16} className="shrink-0 text-terracotta-600" />
                    {room.guestPhone}
                  </a>
                )}
              </div>

              {room.secondGuestName && (
                <div className="rounded-xl border border-taupe/20 bg-page p-3.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink/55">
                    Guest 2
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-sm text-ink">
                    <User size={16} className="shrink-0 text-terracotta-600" />
                    {room.secondGuestName}
                  </p>
                  {room.secondGuestPhone && (
                    <a
                      href={`tel:${room.secondGuestPhone}`}
                      className="focus-ring mt-1 flex items-center gap-2 rounded text-sm text-ink/80 hover:text-terracotta-600"
                    >
                      <Phone size={16} className="shrink-0 text-terracotta-600" />
                      {room.secondGuestPhone}
                    </a>
                  )}
                </div>
              )}

              {room.checkIn && room.checkOut && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-taupe/20 bg-page px-3.5 py-2.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink/55">
                      Check-in
                    </p>
                    <p className="mt-0.5 text-sm text-ink">
                      {format(parseISO(room.checkIn), "EEE, d MMM yyyy")}
                    </p>
                  </div>
                  <div className="rounded-xl border border-taupe/20 bg-page px-3.5 py-2.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink/55">
                      Check-out
                    </p>
                    <p className="mt-0.5 text-sm text-ink">
                      {format(parseISO(room.checkOut), "EEE, d MMM yyyy")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
