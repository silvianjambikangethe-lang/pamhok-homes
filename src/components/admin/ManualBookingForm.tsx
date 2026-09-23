"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Check, Copy, WhatsappLogo } from "@phosphor-icons/react";
import { CHECK_IN_TIME, CHECK_OUT_TIME, SITE, whatsappLink } from "@/lib/site";
import { normalizePhone } from "@/lib/phone";

type GuestCard = {
  roomNames: string[];
  guestName: string;
  checkIn: string;
  checkOut: string;
  bookingReference: string | null;
  portalUrl: string;
  guestPhone: string | null;
  emailSent: boolean;
};

function guestCardText(card: GuestCard) {
  return [
    `${SITE.name} — Booking Confirmation`,
    "",
    `Guest: ${card.guestName}`,
    `Room${card.roomNames.length > 1 ? "s" : ""}: ${card.roomNames.join(", ")}`,
    `Check-in: ${format(parseISO(card.checkIn), "EEE, d MMM yyyy")} at ${CHECK_IN_TIME}`,
    `Check-out: ${format(parseISO(card.checkOut), "EEE, d MMM yyyy")} at ${CHECK_OUT_TIME}`,
    `Reference: ${card.bookingReference ?? "—"}`,
    `Booking page: ${card.portalUrl}`,
  ].join("\n");
}

export default function ManualBookingForm({
  rooms,
}: {
  rooms: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? "");
  const [extraRoomIds, setExtraRoomIds] = useState<string[]>([]);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [card, setCard] = useState<GuestCard | null>(null);
  const [copied, setCopied] = useState(false);

  function toggleExtraRoom(id: string) {
    setExtraRoomIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/admin/bookings/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId,
        extraRoomIds,
        checkIn,
        checkOut,
        guestName,
        guestEmail,
        guestPhone,
      }),
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
    setGuestEmail("");
    setGuestPhone("");
    setExtraRoomIds([]);
    setSubmitting(false);
    router.refresh();
  }

  async function handleCopy() {
    if (!card) return;
    await navigator.clipboard.writeText(guestCardText(card));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const otherRooms = rooms.filter((r) => r.id !== roomId);
  const normalizedGuestPhone = card?.guestPhone ? normalizePhone(card.guestPhone) : null;

  return (
    <div className="rounded-2xl border border-taupe/20 bg-surface p-6 shadow-card">
      <h2 className="font-serif text-lg font-semibold text-ink">
        Book a Guest (phone / walk-in)
      </h2>
      <p className="mt-1 text-sm text-ink/65">
        For reservations made outside the website — creates a real booking and
        blocks the room, same as an online one.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-sm font-medium text-ink/80">Room</label>
            <select
              value={roomId}
              onChange={(e) => {
                setRoomId(e.target.value);
                setExtraRoomIds((prev) => prev.filter((id) => id !== e.target.value));
              }}
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
              maxLength={100}
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              className="focus-ring mt-1.5 w-full rounded-lg border border-taupe/25 bg-page px-3 py-2.5 text-sm text-ink"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-ink/80">
              Guest email <span className="font-normal text-ink/50">(optional)</span>
            </label>
            <input
              type="email"
              maxLength={254}
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              placeholder="For their booking-page link"
              className="focus-ring mt-1.5 w-full rounded-lg border border-taupe/25 bg-page px-3 py-2.5 text-sm text-ink"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-ink/80">
              Guest phone <span className="font-normal text-ink/50">(optional)</span>
            </label>
            <input
              type="tel"
              maxLength={20}
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              placeholder="To share the link on WhatsApp"
              className="focus-ring mt-1.5 w-full rounded-lg border border-taupe/25 bg-page px-3 py-2.5 text-sm text-ink"
            />
          </div>
        </div>

        {otherRooms.length > 0 && (
          <div>
            <label className="text-sm font-medium text-ink/80">
              Additional rooms <span className="font-normal text-ink/50">(optional — for a group under this name)</span>
            </label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {otherRooms.map((r) => (
                <label
                  key={r.id}
                  className={`focus-ring flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    extraRoomIds.includes(r.id)
                      ? "border-terracotta-500 bg-terracotta-50 text-terracotta-700 dark:bg-terracotta-700/20 dark:text-terracotta-300"
                      : "border-taupe/25 text-ink/70 hover:border-terracotta-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={extraRoomIds.includes(r.id)}
                    onChange={() => toggleExtraRoom(r.id)}
                    className="sr-only"
                  />
                  {r.name}
                </label>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !roomId}
          className="focus-ring rounded-full bg-mocha-500 dark:bg-terracotta-500 px-6 py-2.5 text-sm font-semibold text-mousse dark:text-white transition-colors hover:bg-mocha-600 dark:hover:bg-terracotta-600 disabled:opacity-60"
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

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-taupe/20 pt-4">
            <a
              href={card.portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring rounded-full border border-taupe/25 px-3.5 py-1.5 text-xs font-semibold text-ink/80 hover:border-terracotta-300"
            >
              Open booking page
            </a>
            {normalizedGuestPhone && (
              <a
                href={whatsappLink(
                  normalizedGuestPhone,
                  `Hi ${card.guestName}, here's your Pamhok Homes booking page: ${card.portalUrl}`,
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring flex items-center gap-1.5 rounded-full bg-success/10 px-3.5 py-1.5 text-xs font-semibold text-success hover:bg-success/20"
              >
                <WhatsappLogo size={14} weight="fill" /> Share on WhatsApp
              </a>
            )}
            {card.emailSent && (
              <span className="text-xs text-ink/60">Confirmation email sent to guest.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
