"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Check, Copy } from "@phosphor-icons/react";
import { CHECK_IN_TIME, CHECK_OUT_TIME } from "@/lib/site";

type GuestCard = {
  roomName: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  bookingReference: string | null;
};

function guestCardText(card: GuestCard) {
  return [
    "Pamhok Homes — Booking Confirmation",
    "",
    `Guest: ${card.guestName}`,
    `Room: ${card.roomName}`,
    `Check-in: ${format(parseISO(card.checkIn), "EEE, d MMM yyyy")} at ${CHECK_IN_TIME}`,
    `Check-out: ${format(parseISO(card.checkOut), "EEE, d MMM yyyy")} at ${CHECK_OUT_TIME}`,
    `Reference: ${card.bookingReference ?? "—"}`,
  ].join("\n");
}

export default function ManualBookingForm({
  rooms,
}: {
  rooms: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? "");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guestName, setGuestName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [card, setCard] = useState<GuestCard | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/admin/bookings/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, checkIn, checkOut, guestName }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Could not create the booking.");
      setSubmitting(false);
      return;
    }

    setCard(data.guestCard);
    setCheckIn("");
    setCheckOut("");
    setGuestName("");
    setSubmitting(false);
    router.refresh();
  }

  async function handleCopy() {
    if (!card) return;
    await navigator.clipboard.writeText(guestCardText(card));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-2xl border border-taupe/20 bg-surface p-6 shadow-card">
      <h2 className="font-serif text-lg font-semibold text-ink">
        Book a Guest (phone / walk-in)
      </h2>
      <p className="mt-1 text-sm text-ink/65">
        For reservations made outside the website — creates a real booking and
        blocks the room, same as an online one.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="text-sm font-medium text-ink/80">Room</label>
          <select
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="focus-ring mt-1.5 w-full rounded-lg border border-taupe/25 bg-page px-3 py-2.5 text-sm text-ink"
          >
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-ink/80">Check-in</label>
          <input
            type="date"
            required
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            className="focus-ring mt-1.5 w-full rounded-lg border border-taupe/25 bg-page px-3 py-2.5 text-sm text-ink"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-ink/80">Check-out</label>
          <input
            type="date"
            required
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            className="focus-ring mt-1.5 w-full rounded-lg border border-taupe/25 bg-page px-3 py-2.5 text-sm text-ink"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-ink/80">Guest name</label>
          <input
            type="text"
            required
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="e.g. Jane Doe"
            className="focus-ring mt-1.5 w-full rounded-lg border border-taupe/25 bg-page px-3 py-2.5 text-sm text-ink"
          />
        </div>

        {error && <p className="sm:col-span-2 lg:col-span-4 text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !roomId}
          className="focus-ring self-end rounded-full bg-mocha-500 dark:bg-terracotta-500 px-6 py-2.5 text-sm font-semibold text-mousse dark:text-white transition-colors hover:bg-mocha-600 dark:hover:bg-terracotta-600 disabled:opacity-60"
        >
          {submitting ? "Booking…" : "Book Guest"}
        </button>
      </form>

      {card && (
        <div className="mt-5 rounded-2xl border-2 border-terracotta-500 bg-page p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-h3 text-ink">Guest Card</h3>
            <button
              type="button"
              onClick={handleCopy}
              className="focus-ring flex items-center gap-1.5 rounded-full border border-taupe/25 px-3.5 py-1.5 text-xs font-semibold text-ink/80 hover:border-terracotta-300"
            >
              {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy to clipboard"}
            </button>
          </div>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-ink/80">
            {guestCardText(card)}
          </pre>
        </div>
      )}
    </div>
  );
}
