"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { differenceInCalendarDays, format, isAfter, isBefore, isValid, parseISO, startOfDay } from "date-fns";
import { CalendarBlank, Lock, UsersThree, Warning } from "@phosphor-icons/react";
import BookingCalendar, {
  type DateRange,
  type DateSelection,
} from "@/components/BookingCalendar";
import type { AvailabilityRow, Room } from "@/lib/supabase/types";
import type { DisplayCurrency } from "@/lib/currency";
import CurrencySelector from "@/components/CurrencySelector";

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Validates dates carried over from the /rooms listing page's date-first
// search (via ?checkIn=&checkOut= query params) against this room's own
// up-to-date availability — someone could have booked in the gap between
// the guest browsing the list and landing here. Falls back to a blank
// selection (with a heads-up message) rather than trusting the URL.
function resolveInitialSelection(
  initialCheckIn: string | undefined,
  initialCheckOut: string | undefined,
  bookedRanges: DateRange[],
): { selection: DateSelection; wasReset: boolean } {
  const blank = { selection: { checkIn: null, checkOut: null }, wasReset: false };
  if (!initialCheckIn || !initialCheckOut) return blank;

  const checkIn = parseISO(initialCheckIn);
  const checkOut = parseISO(initialCheckOut);
  if (!isValid(checkIn) || !isValid(checkOut) || !isBefore(checkIn, checkOut)) {
    return blank;
  }
  if (isBefore(checkIn, startOfDay(new Date()))) {
    return { selection: { checkIn: null, checkOut: null }, wasReset: true };
  }
  const conflicts = bookedRanges.some(
    (r) => isBefore(r.start, checkOut) && isAfter(r.end, checkIn),
  );
  if (conflicts) {
    return { selection: { checkIn: null, checkOut: null }, wasReset: true };
  }
  return { selection: { checkIn, checkOut }, wasReset: false };
}

// The few fields of another room the picker needs (a group of more than 2
// guests can add these rooms for the same dates).
export interface OtherRoom {
  id: string;
  slug: string;
  name: string;
  price_per_night: number;
  currency: string;
  max_guests: number;
  bed_config: string;
}

export default function BookingWidget({
  room,
  availability,
  otherRooms,
  otherAvailability,
  initialExtraIds = [],
  rates,
  initialCheckIn,
  initialCheckOut,
}: {
  room: Room;
  availability: AvailabilityRow[];
  otherRooms: OtherRoom[];
  otherAvailability: AvailabilityRow[];
  // Units the guest already added to this booking on their own unit pages
  // ("Add unit"), carried back in the URL.
  initialExtraIds?: string[];
  rates: Record<DisplayCurrency, number>;
  initialCheckIn?: string;
  initialCheckOut?: string;
}) {
  const router = useRouter();
  const bookedRanges: DateRange[] = useMemo(
    () =>
      availability.map((a) => ({
        start: new Date(a.check_in),
        end: new Date(a.check_out),
      })),
    [availability],
  );

  const [initialResult] = useState(() =>
    resolveInitialSelection(initialCheckIn, initialCheckOut, bookedRanges),
  );
  const [{ selection, wasReset: datesWereReset }, setSelectionState] =
    useState(initialResult);
  // Dates carried over from the /rooms search are locked on this page: the
  // guest sees them but can't edit them here. A visit with no valid dates
  // (direct link, stale or just-booked dates) keeps the editable calendar,
  // since there'd be no other way to pick dates.
  const [datesLocked] = useState(
    Boolean(initialResult.selection.checkIn && initialResult.selection.checkOut),
  );
  function setSelection(next: DateSelection) {
    setSelectionState({ selection: next, wasReset: false });
  }
  const [guestCount, setGuestCount] = useState<1 | 2 | "other" | null>(
    initialExtraIds.length > 0 ? "other" : null,
  );
  const [guest, setGuest] = useState({ fullName: "", email: "", phone: "" });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [extraRoomIds, setExtraRoomIds] = useState<string[]>(initialExtraIds);

  const nights =
    selection.checkIn && selection.checkOut
      ? differenceInCalendarDays(selection.checkOut, selection.checkIn)
      : 0;
  const datesSelected = Boolean(selection.checkIn && selection.checkOut);

  // Other rooms that are free for the chosen dates (same overlap rule as the
  // server check in /api/bookings, which stays the source of truth).
  const openOtherRooms = useMemo(() => {
    const { checkIn, checkOut } = selection;
    if (!checkIn || !checkOut) return [];
    return otherRooms.filter(
      (r) =>
        !otherAvailability.some(
          (a) =>
            a.room_id === r.id &&
            isBefore(parseISO(a.check_in), checkOut) &&
            isAfter(parseISO(a.check_out), checkIn),
        ),
    );
  }, [otherRooms, otherAvailability, selection]);

  // Extra rooms only count for a group ("Other"), and only while still free
  // for the dates on screen.
  const selectedExtras =
    guestCount === "other"
      ? openOtherRooms.filter((r) => extraRoomIds.includes(r.id))
      : [];
  const roomCount = 1 + selectedExtras.length;
  const total =
    nights *
    (room.price_per_night + selectedExtras.reduce((sum, r) => sum + r.price_per_night, 0));

  function toggleExtraRoom(id: string) {
    setExtraRoomIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  }

  const showGuestDetails =
    datesSelected &&
    (guestCount === 1 || guestCount === 2 || (guestCount === "other" && roomCount > 1));
  const canSubmit =
    showGuestDetails &&
    guest.fullName.trim() &&
    guest.email.trim() &&
    guest.phone.trim() &&
    agreedToTerms &&
    !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !selection.checkIn || !selection.checkOut) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: room.id,
          extraRoomIds: selectedExtras.map((r) => r.id),
          checkIn: format(selection.checkIn, "yyyy-MM-dd"),
          checkOut: format(selection.checkOut, "yyyy-MM-dd"),
          guest,
        }),
      });

      // Every failure, including a name on the host's blocked list, comes back
      // as an ordinary message shown here in the form. There is deliberately no
      // separate "blocked" page, so nobody is told they were singled out.
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setSubmitting(false);
        return;
      }

      router.push(`/portal/${data.accessToken}`);
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div
      id="book"
      className="scroll-mt-24 rounded-2xl border border-taupe/20 bg-pk-surface p-6 glow-gold sm:p-8 dark:bg-surface"
    >
      <div className="flex items-baseline justify-between">
        <p className="font-serif text-price text-ink">
          {formatCurrency(room.price_per_night, room.currency)}
          <span className="text-small font-normal text-ink/65"> / night</span>
        </p>
      </div>

      {datesLocked && selection.checkIn && selection.checkOut ? (
        <div className="mt-6">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink/80">
            <Lock size={18} />
            Your dates
          </p>
          <div
            className="grid grid-cols-2 gap-3"
            role="group"
            aria-label="Your selected dates, locked"
          >
            <div className="rounded-xl border border-taupe/25 bg-page px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/65">
                Check-in
              </p>
              <p className="mt-1 text-sm font-semibold text-ink">
                {format(selection.checkIn, "EEE, d MMM yyyy")}
              </p>
            </div>
            <div className="rounded-xl border border-taupe/25 bg-page px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/65">
                Check-out
              </p>
              <p className="mt-1 text-sm font-semibold text-ink">
                {format(selection.checkOut, "EEE, d MMM yyyy")}
              </p>
            </div>
          </div>
          <p className="mt-2 text-small text-ink/65">
            {nights} night{nights > 1 ? "s" : ""} · Dates are set from your
            search.{" "}
            <Link
              href="/rooms"
              className="focus-ring rounded font-medium text-terracotta-600 underline hover:text-terracotta-700"
            >
              Start a new search
            </Link>
          </p>
        </div>
      ) : (
        <div className="mt-6">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink/80">
            <CalendarBlank size={18} />
            Select your dates
          </p>
          {datesWereReset && (
            <p className="mb-3 flex items-center gap-2 text-sm text-danger">
              <Warning size={16} className="shrink-0" />
              Those dates were just booked — please pick new ones.
            </p>
          )}
          <BookingCalendar
            bookedRanges={bookedRanges}
            selection={selection}
            onChange={setSelection}
          />
        </div>
      )}

      {datesSelected && (
        <div className="mt-6 border-t border-taupe/20 pt-6">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink/80">
            <UsersThree size={18} />
            How many guests?
          </p>
          <div className="flex flex-wrap gap-2">
            {([1, 2, "other"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setGuestCount(option)}
                className={`focus-ring rounded-full border px-5 py-2 text-sm font-semibold transition-colors ${
                  guestCount === option
                    ? "border-pk-primary bg-pk-primary text-pk-on-dark dark:border-terracotta-500 dark:bg-terracotta-500 dark:text-white"
                    : "border-taupe/25 bg-page text-ink/80 hover:border-terracotta-300"
                }`}
              >
                {option === "other" ? "Other" : `${option} Guest${option > 1 ? "s" : ""}`}
              </button>
            ))}
          </div>

          {guestCount === "other" && (
            <div className="mt-4">
              <p className="text-sm text-ink/80">
                Each room sleeps up to 2 guests. Add more rooms for the same
                dates and book them all together under your name.
              </p>

              {openOtherRooms.length === 0 ? (
                <p className="mt-3 flex items-start gap-2 text-sm text-danger">
                  <Warning size={16} className="mt-0.5 shrink-0" />
                  No other rooms are open for these dates. Try different
                  dates, or message us on WhatsApp for a group booking.
                </p>
              ) : (
                <fieldset className="mt-3">
                  <legend className="sr-only">Add rooms for the same dates</legend>
                  <ul className="space-y-2">
                    {openOtherRooms.map((r) => {
                      const checked = extraRoomIds.includes(r.id);
                      return (
                        <li key={r.id}>
                          <label
                            htmlFor={`extra-room-${r.id}`}
                            className={`focus-within:ring-2 flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
                              checked
                                ? "border-pk-primary bg-pk-latte dark:border-terracotta-500 dark:bg-terracotta-700/25"
                                : "border-taupe/25 bg-page hover:border-terracotta-300"
                            }`}
                          >
                            <input
                              id={`extra-room-${r.id}`}
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleExtraRoom(r.id)}
                              className="mt-0.5 h-4 w-4 shrink-0 rounded border-taupe/40 text-terracotta-500 focus:ring-terracotta-500"
                            />
                            <span className="flex-1">
                              <span className="block font-semibold text-ink">{r.name}</span>
                              <span className="block text-small text-ink/65">
                                Up to {r.max_guests} guests · {r.bed_config}
                              </span>
                            </span>
                            <span className="shrink-0 font-semibold text-ink">
                              {formatCurrency(r.price_per_night, r.currency)}
                              <span className="text-small font-normal text-ink/65">
                                {" "}
                                / night
                              </span>
                            </span>
                          </label>
                          <Link
                            href={`/rooms/${r.slug}?checkIn=${format(selection.checkIn!, "yyyy-MM-dd")}&checkOut=${format(selection.checkOut!, "yyyy-MM-dd")}&addTo=${room.slug}${
                              extraRoomIds.length ? `&extras=${extraRoomIds.join(",")}` : ""
                            }`}
                            className="focus-ring mt-1 inline-block rounded px-1 text-small font-semibold text-terracotta-600 underline hover:text-terracotta-700"
                          >
                            See room →
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                  {roomCount === 1 && (
                    <p className="mt-3 text-small text-ink/65">
                      Tick at least one more room to continue.
                    </p>
                  )}
                </fieldset>
              )}
            </div>
          )}
        </div>
      )}

      {showGuestDetails && (
      <form onSubmit={handleSubmit} className="mt-6 space-y-4 border-t border-taupe/20 pt-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="fullName" className="text-sm font-medium text-ink/80">
              Full name
            </label>
            <input
              id="fullName"
              required
              maxLength={100}
              value={guest.fullName}
              onChange={(e) => setGuest((g) => ({ ...g, fullName: e.target.value }))}
              className="focus-ring mt-1.5 w-full rounded-lg border border-taupe/25 bg-page px-3.5 py-2.5 text-sm text-ink"
              autoComplete="name"
            />
          </div>
          <div>
            <label htmlFor="email" className="text-sm font-medium text-ink/80">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              maxLength={254}
              value={guest.email}
              onChange={(e) => setGuest((g) => ({ ...g, email: e.target.value }))}
              className="focus-ring mt-1.5 w-full rounded-lg border border-taupe/25 bg-page px-3.5 py-2.5 text-sm text-ink"
              autoComplete="email"
            />
          </div>
          <div>
            <label htmlFor="phone" className="text-sm font-medium text-ink/80">
              Phone
            </label>
            <input
              id="phone"
              type="tel"
              required
              maxLength={20}
              value={guest.phone}
              onChange={(e) => setGuest((g) => ({ ...g, phone: e.target.value }))}
              className="focus-ring mt-1.5 w-full rounded-lg border border-taupe/25 bg-page px-3.5 py-2.5 text-sm text-ink"
              autoComplete="tel"
            />
          </div>
        </div>

        {nights > 0 && (
          <div className="rounded-xl bg-page px-4 py-3">
            {[room, ...selectedExtras].map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-ink/80">
                  {roomCount > 1 && <span className="font-semibold">{r.name}: </span>}
                  {formatCurrency(r.price_per_night, r.currency)} × {nights} night
                  {nights > 1 ? "s" : ""}
                </span>
              </div>
            ))}
            <CurrencySelector amountKes={total} rates={rates} className="mt-1" />
          </div>
        )}

        <label htmlFor="agreedToTerms" className="flex items-start gap-2.5 text-sm text-ink/80">
          <input
            id="agreedToTerms"
            type="checkbox"
            required
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-taupe/40 text-terracotta-500 focus:ring-terracotta-500"
          />
          <span>
            I agree to the{" "}
            <Link
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring rounded font-medium text-terracotta-600 underline hover:text-terracotta-700"
            >
              Terms &amp; Conditions
            </Link>
          </span>
        </label>

        {error && (
          <p role="alert" className="flex items-center gap-2 text-sm text-danger">
            <Warning size={16} />
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="focus-ring w-full rounded-full bg-mocha-500 dark:bg-terracotta-500 px-6 py-3.5 text-btn text-mousse dark:text-white transition-colors hover:bg-mocha-600 dark:hover:bg-terracotta-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting
            ? "Reserving…"
            : roomCount > 1
              ? `Reserve ${roomCount} rooms — Continue to Payment`
              : "Reserve — Continue to Payment"}
        </button>
        <p className="text-center text-small text-ink/65">
          You won&apos;t be charged yet. Choose your payment method next.
          {roomCount > 1 &&
            " Each room is paid for on its own booking page, linked from the first."}
        </p>
      </form>
      )}
    </div>
  );
}
