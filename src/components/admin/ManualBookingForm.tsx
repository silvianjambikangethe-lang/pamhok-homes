"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { CaretDown, Check, Copy, WhatsappLogo } from "@phosphor-icons/react";
import { CHECK_IN_TIME, CHECK_OUT_TIME, SITE, whatsappLink } from "@/lib/site";
import { normalizePhone } from "@/lib/phone";

type RoomCard = {
  roomName: string;
  portalUrl: string;
  occupantName: string | null;
  occupantEmail: string | null;
  occupantPhone: string | null;
  emailSent: boolean;
};

type GuestCard = {
  roomNames: string[];
  guestName: string;
  checkIn: string;
  checkOut: string;
  bookingReference: string | null;
  portalUrl: string;
  guestPhone: string | null;
  emailSent: boolean;
  rooms: RoomCard[];
};

type ExtraGuestInput = { name: string; email: string; phone: string };

function guestCardText(card: GuestCard) {
  return [
    `${SITE.name} - Booking Confirmation`,
    "",
    `Guest: ${card.guestName}`,
    `Room${card.roomNames.length > 1 ? "s" : ""}: ${card.roomNames.join(", ")}`,
    `Check-in: ${format(parseISO(card.checkIn), "EEE, d MMM yyyy")} at ${CHECK_IN_TIME}`,
    `Check-out: ${format(parseISO(card.checkOut), "EEE, d MMM yyyy")} at ${CHECK_OUT_TIME}`,
    `Reference: ${card.bookingReference ?? "-"}`,
    `Booking page: ${card.portalUrl}`,
  ].join("\n");
}

export default function ManualBookingForm({
  rooms,
}: {
  // Only used to tell whether the property has rooms at all before any
  // dates are picked. Once check-in/check-out are both set, the Room field
  // switches to whatever /api/admin/rooms/availability returns for that
  // range, never this static list, so a walk-in can never be booked into a
  // room that's actually already taken for those dates.
  rooms: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [roomId, setRoomId] = useState("");
  const [extraRoomIds, setExtraRoomIds] = useState<string[]>([]);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  // Second guest sharing the primary room (a room sleeps up to 2) —
  // display-only, shown later in that room's Room Status popup.
  const [secondGuestName, setSecondGuestName] = useState("");
  const [secondGuestPhone, setSecondGuestPhone] = useState("");
  // Per-extra-room occupant details (a friend taking that room) — keyed by
  // roomId, only meaningful for ids currently in extraRoomIds.
  const [extraGuestInputs, setExtraGuestInputs] = useState<Record<string, ExtraGuestInput>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [card, setCard] = useState<GuestCard | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [availableRooms, setAvailableRooms] = useState<{ id: string; name: string }[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const datesChosen = Boolean(checkIn && checkOut);

  // Picking both dates triggers the list of rooms actually free for that
  // bracket — the Room field (and the "additional rooms" group list below
  // it) only ever offers what this returns, so the rest of the manual
  // booking can commence against real availability instead of the admin's
  // own memory of the calendar.
  useEffect(() => {
    if (!datesChosen) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off the fetch below, not a render sync
    setLoadingRooms(true);
    setRoomsError(null);
    fetch(`/api/admin/rooms/availability?checkIn=${checkIn}&checkOut=${checkOut}`)
      .then(async (res) => ({ ok: res.ok, data: await res.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok) {
          setRoomsError(data.error ?? "Could not load available rooms.");
          setAvailableRooms([]);
          return;
        }
        setAvailableRooms(data.rooms ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setRoomsError("Could not load available rooms.");
          setAvailableRooms([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingRooms(false);
      });
    return () => {
      cancelled = true;
    };
  }, [checkIn, checkOut, datesChosen]);

  // Keep the current room selection (and any ticked extras) valid as the
  // available-rooms list changes under them.
  useEffect(() => {
    if (!datesChosen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs the selection with the freshly fetched room list, an external data source
    setRoomId((prev) => (availableRooms.some((r) => r.id === prev) ? prev : availableRooms[0]?.id ?? ""));
    setExtraRoomIds((prev) => prev.filter((id) => availableRooms.some((r) => r.id === id)));
  }, [availableRooms, datesChosen]);

  function toggleExtraRoom(id: string) {
    setExtraRoomIds((prev) => {
      const next = prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id];
      if (!next.includes(id)) {
        setExtraGuestInputs((inputs) => {
          if (!(id in inputs)) return inputs;
          const rest = { ...inputs };
          delete rest[id];
          return rest;
        });
      }
      return next;
    });
  }

  function updateExtraGuestInput(roomId: string, field: keyof ExtraGuestInput, value: string) {
    setExtraGuestInputs((prev) => {
      const current = prev[roomId] ?? { name: "", email: "", phone: "" };
      return { ...prev, [roomId]: { ...current, [field]: value } };
    });
  }

  // Clearing either date (or not having both yet) means there's no
  // availability result to pick a room from — drop whatever was selected
  // right in the handler rather than via an effect, since this is a direct
  // reaction to the admin's own edit, not a sync with fetched data.
  function handleDateChange(which: "checkIn" | "checkOut", value: string) {
    const nextCheckIn = which === "checkIn" ? value : checkIn;
    const nextCheckOut = which === "checkOut" ? value : checkOut;
    if (which === "checkIn") setCheckIn(value);
    else setCheckOut(value);
    if (!nextCheckIn || !nextCheckOut) {
      setRoomId("");
      setExtraRoomIds([]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const extraRoomGuests = Object.fromEntries(
      extraRoomIds
        .map((id) => [id, extraGuestInputs[id]] as const)
        .filter(([, v]) => v && (v.name.trim() || v.email.trim() || v.phone.trim())),
    );

    const res = await fetch("/api/admin/bookings/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId,
        extraRoomIds,
        extraRoomGuests,
        checkIn,
        checkOut,
        guestName,
        guestEmail,
        guestPhone,
        secondGuestName,
        secondGuestPhone,
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
    setSecondGuestName("");
    setSecondGuestPhone("");
    setExtraRoomIds([]);
    setExtraGuestInputs({});
    setSubmitting(false);
    router.refresh();
  }

  async function handleCopy(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied((prev) => (prev === key ? null : prev)), 2000);
  }

  const otherRooms = availableRooms.filter((r) => r.id !== roomId);
  const normalizedGuestPhone = card?.guestPhone ? normalizePhone(card.guestPhone) : null;
  const hasAnyRooms = rooms.length > 0;

  return (
    <div className="rounded-2xl border border-taupe/20 bg-surface p-6 shadow-card">
      <h2 className="font-serif text-lg font-semibold text-ink">
        Book a Guest (phone / walk-in)
      </h2>
      <p className="mt-1 text-sm text-ink/65">
        For reservations made outside the website, creates a real booking and
        blocks the room, same as an online one.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-sm font-medium text-ink/80">Check-in</label>
            <input
              type="date"
              required
              value={checkIn}
              onChange={(e) => handleDateChange("checkIn", e.target.value)}
              className="focus-ring mt-1.5 w-full rounded-lg border border-taupe/25 bg-page px-3 py-2.5 text-sm text-ink"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-ink/80">Check-out</label>
            <input
              type="date"
              required
              value={checkOut}
              onChange={(e) => handleDateChange("checkOut", e.target.value)}
              className="focus-ring mt-1.5 w-full rounded-lg border border-taupe/25 bg-page px-3 py-2.5 text-sm text-ink"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-ink/80">Room</label>
            <div className="relative mt-1.5">
              <select
                value={roomId}
                disabled={!datesChosen || loadingRooms || availableRooms.length === 0}
                onChange={(e) => {
                  setRoomId(e.target.value);
                  setExtraRoomIds((prev) => prev.filter((id) => id !== e.target.value));
                }}
                className="focus-ring w-full appearance-none rounded-lg border border-taupe/25 bg-page px-3 py-2.5 pr-9 text-sm text-ink disabled:cursor-not-allowed disabled:opacity-60"
              >
                {!datesChosen && <option value="">Pick dates first</option>}
                {datesChosen && loadingRooms && <option value="">Checking availability…</option>}
                {datesChosen && !loadingRooms && availableRooms.length === 0 && (
                  <option value="">No rooms free for these dates</option>
                )}
                {datesChosen &&
                  availableRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </select>
              <CaretDown
                size={14}
                weight="bold"
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink/50"
              />
            </div>
            {!datesChosen && hasAnyRooms && (
              <p className="mt-1 text-xs text-ink/50">Pick check-in and check-out to see free rooms.</p>
            )}
            {roomsError && <p className="mt-1 text-xs text-danger">{roomsError}</p>}
            {datesChosen && !loadingRooms && !roomsError && availableRooms.length === 0 && (
              <p className="mt-1 text-xs text-danger">No rooms are free for those dates.</p>
            )}
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
          <div>
            <label className="text-sm font-medium text-ink/80">
              2nd guest name <span className="font-normal text-ink/50">(optional)</span>
            </label>
            <input
              type="text"
              maxLength={100}
              value={secondGuestName}
              onChange={(e) => setSecondGuestName(e.target.value)}
              placeholder="If this room is for 2 guests"
              className="focus-ring mt-1.5 w-full rounded-lg border border-taupe/25 bg-page px-3 py-2.5 text-sm text-ink"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-ink/80">
              2nd guest phone <span className="font-normal text-ink/50">(optional)</span>
            </label>
            <input
              type="tel"
              maxLength={20}
              value={secondGuestPhone}
              onChange={(e) => setSecondGuestPhone(e.target.value)}
              className="focus-ring mt-1.5 w-full rounded-lg border border-taupe/25 bg-page px-3 py-2.5 text-sm text-ink"
            />
          </div>
        </div>

        {datesChosen && otherRooms.length > 0 && (
          <div>
            <label className="text-sm font-medium text-ink/80">
              Additional rooms <span className="font-normal text-ink/50">(optional, for a group under this name)</span>
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

            {extraRoomIds.length > 0 && (
              <div className="mt-3 space-y-3">
                {extraRoomIds.map((id) => {
                  const roomName = otherRooms.find((r) => r.id === id)?.name ?? "Room";
                  const input = extraGuestInputs[id] ?? { name: "", email: "", phone: "" };
                  return (
                    <div key={id} className="rounded-xl border border-taupe/20 bg-page p-3">
                      <p className="text-xs font-semibold text-ink/70">
                        {roomName} — who&apos;s staying here?{" "}
                        <span className="font-normal text-ink/50">
                          (optional — leave blank to keep it under {guestName.trim() || "this name"})
                        </span>
                      </p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        <input
                          type="text"
                          maxLength={100}
                          placeholder="Name"
                          value={input.name}
                          onChange={(e) => updateExtraGuestInput(id, "name", e.target.value)}
                          className="focus-ring w-full rounded-lg border border-taupe/25 bg-surface px-3 py-2 text-sm text-ink"
                        />
                        <input
                          type="email"
                          maxLength={254}
                          placeholder="Email (for their room card)"
                          value={input.email}
                          onChange={(e) => updateExtraGuestInput(id, "email", e.target.value)}
                          className="focus-ring w-full rounded-lg border border-taupe/25 bg-surface px-3 py-2 text-sm text-ink"
                        />
                        <input
                          type="tel"
                          maxLength={20}
                          placeholder="Phone"
                          value={input.phone}
                          onChange={(e) => updateExtraGuestInput(id, "phone", e.target.value)}
                          className="focus-ring w-full rounded-lg border border-taupe/25 bg-surface px-3 py-2 text-sm text-ink"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !roomId || !datesChosen}
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
              onClick={() => handleCopy(guestCardText(card), "main")}
              className="focus-ring flex items-center gap-1.5 rounded-full border border-taupe/25 px-3.5 py-1.5 text-xs font-semibold text-ink/80 hover:border-terracotta-300"
            >
              {copied === "main" ? <Check size={14} className="text-success" /> : <Copy size={14} />}
              {copied === "main" ? "Copied" : "Copy to clipboard"}
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

          {card.rooms.length > 1 && (
            <div className="mt-4 space-y-2 border-t border-taupe/20 pt-4">
              <p className="text-xs font-semibold text-ink/70">Each room&apos;s own link</p>
              {card.rooms.map((r, i) => {
                const key = `room-${i}`;
                return (
                  <div
                    key={key}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-taupe/20 bg-page px-3.5 py-2.5"
                  >
                    <div className="text-sm">
                      <span className="font-semibold text-ink">{r.roomName}</span>
                      {r.occupantName ? (
                        <span className="text-ink/65"> — {r.occupantName}</span>
                      ) : (
                        <span className="text-ink/50"> — {card.guestName}</span>
                      )}
                      {r.emailSent && (
                        <span className="ml-2 text-xs text-ink/50">(emailed)</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(r.portalUrl, key)}
                      className="focus-ring flex items-center gap-1.5 rounded-full border border-taupe/25 px-3 py-1 text-xs font-semibold text-ink/80 hover:border-terracotta-300"
                    >
                      {copied === key ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                      {copied === key ? "Copied" : "Copy link"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
