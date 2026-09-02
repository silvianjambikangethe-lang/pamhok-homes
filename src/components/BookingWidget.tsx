"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { differenceInCalendarDays, format, isAfter, isBefore, isValid, parseISO, startOfDay } from "date-fns";
import { CalendarBlank, UsersThree, Warning } from "@phosphor-icons/react";
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

export default function BookingWidget({
  room,
  availability,
  rates,
  initialCheckIn,
  initialCheckOut,
}: {
  room: Room;
  availability: AvailabilityRow[];
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

  const [{ selection, wasReset: datesWereReset }, setSelectionState] = useState(() => {
    const result = resolveInitialSelection(initialCheckIn, initialCheckOut, bookedRanges);
    return result;
  });
  function setSelection(next: DateSelection) {
    setSelectionState({ selection: next, wasReset: false });
  }
  const [guestCount, setGuestCount] = useState<1 | 2 | "other" | null>(null);
  const [guest, setGuest] = useState({ fullName: "", email: "", phone: "" });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nights =
    selection.checkIn && selection.checkOut
      ? differenceInCalendarDays(selection.checkOut, selection.checkIn)
      : 0;
  const total = nights * room.price_per_night;
  const datesSelected = Boolean(selection.checkIn && selection.checkOut);
  const showGuestDetails = datesSelected && (guestCount === 1 || guestCount === 2);
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
          checkIn: format(selection.checkIn, "yyyy-MM-dd"),
          checkOut: format(selection.checkOut, "yyyy-MM-dd"),
          guest,
        }),
      });

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
    <div className="rounded-2xl border border-taupe/20 bg-surface p-6 shadow-warm sm:p-8">
      <div className="flex items-baseline justify-between">
        <p className="font-serif text-price text-ink">
          {formatCurrency(room.price_per_night, room.currency)}
          <span className="text-small font-normal text-ink/65"> / night</span>
        </p>
      </div>

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
                    ? "border-terracotta-500 bg-terracotta-500 text-white"
                    : "border-taupe/25 bg-page text-ink/80 hover:border-terracotta-300"
                }`}
              >
                {option === "other" ? "Other" : `${option} Guest${option > 1 ? "s" : ""}`}
              </button>
            ))}
          </div>

          {guestCount === "other" && (
            <p className="mt-3 flex items-start gap-2 text-sm text-danger">
              <Warning size={16} className="mt-0.5 shrink-0" />
              We only allow 2 guests per room — please consider booking
              another room for your group.
            </p>
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
              value={guest.phone}
              onChange={(e) => setGuest((g) => ({ ...g, phone: e.target.value }))}
              className="focus-ring mt-1.5 w-full rounded-lg border border-taupe/25 bg-page px-3.5 py-2.5 text-sm text-ink"
              autoComplete="tel"
            />
          </div>
        </div>

        {nights > 0 && (
          <div className="rounded-xl bg-page px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink/80">
                {formatCurrency(room.price_per_night, room.currency)} ×{" "}
                {nights} night{nights > 1 ? "s" : ""}
              </span>
            </div>
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
          {submitting ? "Reserving…" : "Reserve — Continue to Payment"}
        </button>
        <p className="text-center text-small text-ink/65">
          You won&apos;t be charged yet. Choose your payment method next.
        </p>
      </form>
      )}
    </div>
  );
}
