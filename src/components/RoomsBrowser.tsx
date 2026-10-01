"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { differenceInCalendarDays, format, isAfter, isBefore, isValid, parseISO, startOfDay } from "date-fns";
import { CalendarBlank, CheckCircle, UsersThree, IdentificationBadge } from "@phosphor-icons/react";
import RoomPhoto from "@/components/RoomPhoto";
import { getClosedRanges } from "@/lib/closed-dates";
import BookingCalendar, { type DateRange, type DateSelection } from "@/components/BookingCalendar";
import type { AvailabilityRow, Room } from "@/lib/supabase/types";
import {
  readStoredRecognition,
  writeStoredRecognition,
  type StoredRecognition,
} from "@/lib/guest-recognition-storage";

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Same overlap rule as the server-side check in /api/bookings: a room is
// unavailable for [checkIn, checkOut) if any existing booking/block range
// intersects it at all.
function isRoomAvailable(
  roomId: string,
  checkIn: Date,
  checkOut: Date,
  availability: AvailabilityRow[],
) {
  return !availability.some((a) => {
    if (a.room_id !== roomId) return false;
    return isBefore(parseISO(a.check_in), checkOut) && isAfter(parseISO(a.check_out), checkIn);
  });
}

export default function RoomsBrowser({
  rooms,
  availability,
}: {
  rooms: Room[];
  availability: AvailabilityRow[];
}) {
  const searchParams = useSearchParams();
  const changeFrom = searchParams.get("changeFrom") ?? undefined;

  // Pre-fill dates from URL when returning from a cancelled booking (changeFrom flow).
  // Dates stay editable so the guest can pick different ones.
  const [selection, setSelection] = useState<DateSelection>(() => {
    const ci = searchParams.get("checkIn");
    const co = searchParams.get("checkOut");
    if (!ci || !co) return { checkIn: null, checkOut: null };
    const checkIn = parseISO(ci);
    const checkOut = parseISO(co);
    if (
      !isValid(checkIn) ||
      !isValid(checkOut) ||
      !isBefore(checkIn, checkOut) ||
      isBefore(checkIn, startOfDay(new Date()))
    ) {
      return { checkIn: null, checkOut: null };
    }
    return { checkIn, checkOut };
  });
  const datesSelected = Boolean(selection.checkIn && selection.checkOut);

  const [recognized, setRecognized] = useState<StoredRecognition | null>(null);
  const [recognitionOpen, setRecognitionOpen] = useState(false);
  const [recognitionStep, setRecognitionStep] = useState<"email" | "code">("email");
  const [recognitionName, setRecognitionName] = useState("");
  const [recognitionEmail, setRecognitionEmail] = useState("");
  const [recognitionCode, setRecognitionCode] = useState("");
  const [recognitionSubmitting, setRecognitionSubmitting] = useState(false);
  const [recognitionError, setRecognitionError] = useState<string | null>(null);
  const [recognitionNotice, setRecognitionNotice] = useState<string | null>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sessionStorage read, not a render sync
    setRecognized(readStoredRecognition());
  }, []);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!recognitionName.trim() || !recognitionEmail.trim()) return;
    setRecognitionSubmitting(true);
    setRecognitionError(null);
    try {
      const res = await fetch("/api/guest-recognition/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: recognitionEmail.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setRecognitionError(data?.error ?? "Something went wrong. Please try again.");
        setRecognitionSubmitting(false);
        return;
      }
      setRecognitionNotice(`If ${recognitionEmail.trim()} is on file, we've sent it a code.`);
      setRecognitionStep("code");
      setRecognitionSubmitting(false);
    } catch {
      setRecognitionError("Something went wrong. Please try again.");
      setRecognitionSubmitting(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(recognitionCode.trim())) return;
    setRecognitionSubmitting(true);
    setRecognitionError(null);
    try {
      const res = await fetch("/api/guest-recognition/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: recognitionEmail.trim(), code: recognitionCode.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setRecognitionError(data?.error ?? "That code doesn't look right.");
        setRecognitionSubmitting(false);
        return;
      }
      const stored: StoredRecognition = {
        recognitionToken: data.recognitionToken,
        fullName: data.fullName,
        email: recognitionEmail.trim(),
        issuedAt: Date.now(),
      };
      writeStoredRecognition(stored);
      setRecognized(stored);
      setRecognitionOpen(false);
      setRecognitionSubmitting(false);
      // Verified — send them straight to the calendar already on this page
      // (now personalized) rather than leaving them looking at a closed modal.
      calendarRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch {
      setRecognitionError("Something went wrong. Please try again.");
      setRecognitionSubmitting(false);
    }
  }

  function resetRecognitionPanel() {
    setRecognitionOpen(false);
    setRecognitionStep("email");
    setRecognitionName("");
    setRecognitionEmail("");
    setRecognitionCode("");
    setRecognitionError(null);
    setRecognitionNotice(null);
  }

  // A night shows as closed (crossed out) only when EVERY room is taken that
  // night. Nothing about who booked, or whether they have paid, is shown.
  const closedRanges = useMemo<DateRange[]>(
    () => getClosedRanges(rooms, availability),
    [rooms, availability],
  );

  const availableRooms = useMemo(() => {
    if (!selection.checkIn || !selection.checkOut) return [];
    return rooms.filter((room) =>
      isRoomAvailable(room.id, selection.checkIn!, selection.checkOut!, availability),
    );
  }, [rooms, availability, selection]);

  const nights =
    selection.checkIn && selection.checkOut
      ? differenceInCalendarDays(selection.checkOut, selection.checkIn)
      : 0;

  const dateQuery = datesSelected
    ? `?checkIn=${format(selection.checkIn!, "yyyy-MM-dd")}&checkOut=${format(selection.checkOut!, "yyyy-MM-dd")}${changeFrom ? `&changeFrom=${changeFrom}` : ""}`
    : "";

  return (
    <>
      {changeFrom && (
        <div className="mx-auto mb-6 flex max-w-md items-start gap-3 rounded-2xl border border-forest-500/30 bg-forest-500/10 p-4 text-sm text-ink/80">
          <CheckCircle size={20} weight="fill" className="mt-0.5 shrink-0 text-forest-600 dark:text-sage-400" />
          <p>
            Your ID is already verified, you won&apos;t need to re-upload it
            for the new room. Pick your dates and select a room to continue.
          </p>
        </div>
      )}
      <div className="mx-auto mb-4 max-w-md">
        {recognized ? (
          // clay is static hex (not the brown-light-theme CSS variables the
          // rest of this page's accents use — see globals.css), so this
          // card stays a vivid warm orange in both light and dark mode
          // instead of collapsing into the same muted brown as the
          // terracotta/mocha/gold buttons elsewhere on the page.
          <div className="rounded-2xl border border-clay-500/40 bg-clay-500/15 p-5 text-ink shadow-card">
            <div className="flex items-start gap-3">
              <CheckCircle size={22} weight="fill" className="mt-0.5 shrink-0 text-clay-600" />
              <div className="flex-1">
                <p className="font-serif text-h3">Welcome back, {recognized.fullName}!</p>
                <p className="mt-1 text-sm text-ink/80">
                  So good to have you stay with us again.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setRecognitionOpen(true)}
            className="focus-ring flex w-full items-center justify-center gap-2 rounded-full bg-clay-500 px-6 py-3 text-sm font-semibold text-white shadow-card transition-colors hover:bg-clay-600"
          >
            <IdentificationBadge size={18} weight="fill" />
            Remember Me
          </button>
        )}
      </div>

      <div ref={calendarRef} className="mx-auto max-w-md scroll-mt-24 rounded-2xl border border-taupe/20 bg-pk-surface p-6 glow-gold dark:bg-surface">
        <p className="mb-3 flex items-center justify-center gap-2 text-sm font-semibold text-ink/80">
          <CalendarBlank size={18} />
          {recognized ? "How long will you be staying?" : "Select your dates to see available rooms"}
        </p>
        <BookingCalendar bookedRanges={closedRanges} selection={selection} onChange={setSelection} />
      </div>

      {recognitionOpen && !recognized && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
          onClick={resetRecognitionPanel}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-taupe/20 bg-surface p-5 shadow-warm"
          >
            {recognitionStep === "email" ? (
              <form onSubmit={handleSendCode} className="space-y-3">
                <p className="text-sm font-semibold text-ink/80">
                  Been here before? Enter your details to book faster.
                </p>
                <div>
                  <label htmlFor="recognitionName" className="text-sm font-medium text-ink/80">
                    Full name
                  </label>
                  <input
                    id="recognitionName"
                    required
                    maxLength={100}
                    value={recognitionName}
                    onChange={(e) => setRecognitionName(e.target.value)}
                    autoComplete="name"
                    className="focus-ring mt-1.5 w-full rounded-lg border border-taupe/25 bg-page px-3.5 py-2.5 text-sm text-ink"
                  />
                </div>
                <div>
                  <label htmlFor="recognitionEmail" className="text-sm font-medium text-ink/80">
                    Email
                  </label>
                  <input
                    id="recognitionEmail"
                    type="email"
                    required
                    maxLength={254}
                    value={recognitionEmail}
                    onChange={(e) => setRecognitionEmail(e.target.value)}
                    autoComplete="email"
                    className="focus-ring mt-1.5 w-full rounded-lg border border-taupe/25 bg-page px-3.5 py-2.5 text-sm text-ink"
                  />
                </div>
                {recognitionError && (
                  <p role="alert" className="text-sm text-danger">
                    {recognitionError}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={recognitionSubmitting}
                    className="focus-ring flex-1 rounded-full bg-mocha-500 dark:bg-terracotta-500 px-5 py-2.5 text-sm font-semibold text-mousse dark:text-white transition-colors hover:bg-mocha-600 dark:hover:bg-terracotta-600 disabled:opacity-60"
                  >
                    {recognitionSubmitting ? "Sending…" : "Send code"}
                  </button>
                  <button
                    type="button"
                    onClick={resetRecognitionPanel}
                    className="focus-ring rounded-full border border-taupe/25 px-5 py-2.5 text-sm font-semibold text-ink/80 hover:bg-taupe/10"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyCode} className="space-y-3">
                {recognitionNotice && (
                  <p className="text-sm text-ink/70">{recognitionNotice}</p>
                )}
                <div>
                  <label htmlFor="recognitionCode" className="text-sm font-medium text-ink/80">
                    6-digit code
                  </label>
                  <input
                    id="recognitionCode"
                    inputMode="numeric"
                    pattern="\d{6}"
                    required
                    maxLength={6}
                    value={recognitionCode}
                    onChange={(e) => setRecognitionCode(e.target.value.replace(/\D/g, ""))}
                    className="focus-ring mt-1.5 w-full rounded-lg border border-taupe/25 bg-page px-3.5 py-2.5 text-center text-lg tracking-[0.3em] text-ink"
                  />
                </div>
                {recognitionError && (
                  <p role="alert" className="text-sm text-danger">
                    {recognitionError}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={recognitionSubmitting}
                    className="focus-ring flex-1 rounded-full bg-mocha-500 dark:bg-terracotta-500 px-5 py-2.5 text-sm font-semibold text-mousse dark:text-white transition-colors hover:bg-mocha-600 dark:hover:bg-terracotta-600 disabled:opacity-60"
                  >
                    {recognitionSubmitting ? "Verifying…" : "Verify"}
                  </button>
                  <button
                    type="button"
                    onClick={resetRecognitionPanel}
                    className="focus-ring rounded-full border border-taupe/25 px-5 py-2.5 text-sm font-semibold text-ink/80 hover:bg-taupe/10"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {!datesSelected && (
        <p className="mx-auto mt-10 max-w-xl text-center text-body-sm text-ink/65">
          Pick a check-in and check-out date above to see which rooms are open.
        </p>
      )}

      {datesSelected && availableRooms.length === 0 && (
        <div className="mx-auto mt-10 max-w-xl text-center">
          <p className="text-body-sm text-ink/65">
            No rooms are open from {format(selection.checkIn!, "d MMM")} to{" "}
            {format(selection.checkOut!, "d MMM yyyy")}. Try different dates, or
            message us on WhatsApp, we may be able to help.
          </p>
          <button
            type="button"
            onClick={() => setSelection({ checkIn: null, checkOut: null })}
            className="focus-ring mt-4 rounded-full border border-taupe/25 px-5 py-2 text-sm font-semibold text-ink/80 hover:border-terracotta-300"
          >
            Clear dates and try again
          </button>
        </div>
      )}

      {datesSelected && availableRooms.length > 0 && (
        <div className="mt-12">
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="font-serif text-h2 text-ink">
              {availableRooms.length} room{availableRooms.length > 1 ? "s" : ""} open
            </h2>
            <p className="text-body-sm text-ink/80">
              {format(selection.checkIn!, "EEE d MMM")} to{" "}
              {format(selection.checkOut!, "EEE d MMM yyyy")} · {nights} night
              {nights > 1 ? "s" : ""}
            </p>
          </div>
          <div className="rounded-2xl bg-pk-sunken p-6 sm:p-8 dark:bg-transparent dark:p-0 dark:sm:p-0">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {availableRooms.map((room) => (
            <Link
              key={room.id}
              href={`/rooms/${room.slug}${dateQuery}`}
              className="focus-ring group flex cursor-default flex-col overflow-hidden rounded-2xl border card-pop bg-pk-surface dark:bg-surface transition-all duration-300 active:-translate-y-0.5 md:cursor-pointer md:hover:-translate-y-1"
            >
              <RoomPhoto
                url={room.photo_urls?.[0]}
                label={room.photo_labels?.[0] ?? room.name}
                seed={room.slug}
                className="photo-frame aspect-[4/3] w-full transition-transform duration-300 group-active:scale-105 md:group-hover:scale-105"
              />
              <div className="flex flex-1 flex-col p-6">
                <h2 className="font-serif text-h3 text-ink group-active:text-terracotta-600 md:group-hover:text-terracotta-600">
                  {room.name}
                </h2>
                <p className="mt-2 line-clamp-2 text-body-sm text-ink/80">
                  {room.description}
                </p>
                <div className="mt-3 flex items-center gap-1.5 text-small text-ink/80">
                  <UsersThree size={16} />
                  Up to {room.max_guests} guests · {room.bed_config}
                </div>
                <div className="mt-4 border-t border-taupe/20 pt-4">
                  <span className="font-serif text-price text-terracotta-600 dark:text-terracotta-600">
                    {formatCurrency(room.price_per_night, room.currency)}
                    <span className="whitespace-nowrap text-small font-normal text-ink/65">
                      {" "}
                      / night
                    </span>
                  </span>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-small text-ink/80">
                      {formatCurrency(room.price_per_night * nights, room.currency)} for{" "}
                      {nights} night{nights > 1 ? "s" : ""}
                    </p>
                    <span className="shrink-0 rounded-full bg-mocha-500 px-4 py-2 text-btn text-mousse transition-colors group-hover:bg-mocha-600 dark:bg-terracotta-500 dark:text-white">
                      View room
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
          </div>
          </div>
        </div>
      )}
    </>
  );
}
