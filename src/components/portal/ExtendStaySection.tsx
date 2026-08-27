"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns";
import { CalendarPlus, Clock, DoorOpen, Phone, Warning, WhatsappLogo } from "@phosphor-icons/react";
import { whatsappLink } from "@/lib/site";

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

const HOLD_HOURS = 3;

interface AlternateRoom {
  roomId: string;
  name: string;
  additionalCost: number;
  currency: string;
}

interface Quote {
  available: boolean;
  additionalCost?: number;
  currency?: string;
  message?: string;
  newCheckOut?: string;
  alternateRooms?: AlternateRoom[];
}

export default function ExtendStaySection({
  token,
  checkOut,
  pendingExtensionCheckOut,
  pendingExtensionNights,
  pendingExtensionRequestedAt,
  adminPhone,
  bookingReference,
}: {
  token: string;
  checkOut: string;
  pendingExtensionCheckOut: string | null;
  pendingExtensionNights: number | null;
  pendingExtensionRequestedAt: string | null;
  adminPhone: string | null;
  bookingReference: string | null;
}) {
  const router = useRouter();
  const daysUntilCheckout = differenceInCalendarDays(startOfDay(parseISO(checkOut)), startOfDay(new Date()));

  const [open, setOpen] = useState(false);
  const [nights, setNights] = useState(1);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [checking, setChecking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [transferringRoomId, setTransferringRoomId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCheck() {
    setChecking(true);
    setError(null);
    setQuote(null);
    try {
      const res = await fetch(`/api/portal/${token}/extend/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ additionalNights: nights }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not check availability.");
        setChecking(false);
        return;
      }
      setQuote(data);
      setChecking(false);
    } catch {
      setError("Could not check availability.");
      setChecking(false);
    }
  }

  async function handleConfirm() {
    setConfirming(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/${token}/extend/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ additionalNights: nights }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not extend your stay.");
        setConfirming(false);
        return;
      }
      router.refresh();
      // router.refresh() re-fetches server data but doesn't remount this
      // component (an extension leaves the guest "active", so this
      // section stays mounted), so the loading state has to be reset by
      // hand rather than relying on the success path unmounting it.
      setOpen(false);
      setQuote(null);
      setConfirming(false);
    } catch {
      setError("Could not extend your stay.");
      setConfirming(false);
    }
  }

  async function handleTransfer(roomId: string) {
    if (!quote?.newCheckOut) return;
    setTransferringRoomId(roomId);
    setError(null);
    try {
      const res = await fetch(`/api/portal/${token}/extend/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, checkOut: quote.newCheckOut }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not book that room.");
        setTransferringRoomId(null);
        return;
      }
      router.push(`/portal/${data.accessToken}`);
    } catch {
      setError("Could not book that room.");
      setTransferringRoomId(null);
    }
  }

  const isUrgent = daysUntilCheckout <= 1;

  const contactBlock = adminPhone && (
    <div className="flex flex-wrap items-center gap-3 border-t border-taupe/20 pt-3 text-sm text-ink/70">
      <span>Need a hand?</span>
      <a
        href={whatsappLink(
          adminPhone,
          bookingReference
            ? `Hi! I have a question about extending my stay, booking ${bookingReference}.`
            : "Hi! I have a question about extending my stay.",
        )}
        target="_blank"
        rel="noopener noreferrer"
        className="focus-ring flex items-center gap-1.5 font-semibold text-success hover:opacity-80"
      >
        <WhatsappLogo size={16} weight="fill" />
        WhatsApp
      </a>
      <a
        href={`tel:${adminPhone}`}
        className="focus-ring flex items-center gap-1.5 font-semibold text-terracotta-600 hover:text-terracotta-700"
      >
        <Phone size={16} weight="fill" />
        Call {adminPhone}
      </a>
    </div>
  );

  if (pendingExtensionCheckOut) {
    const deadline = pendingExtensionRequestedAt
      ? new Date(new Date(pendingExtensionRequestedAt).getTime() + HOLD_HOURS * 60 * 60 * 1000)
      : null;
    return (
      <div className="rounded-2xl border border-gold-500/40 bg-gold-500/15 p-5 text-sm text-cocoa shadow-card dark:bg-gold-500/20 dark:text-espresso">
        <div className="flex items-start gap-3">
          <Clock size={20} className="mt-0.5 shrink-0" />
          <p>
            You requested {pendingExtensionNights} extra night
            {pendingExtensionNights === 1 ? "" : "s"}, extending your stay to{" "}
            <strong>{format(parseISO(pendingExtensionCheckOut), "EEE, d MMM yyyy")}</strong>.
            These nights are held for you, but not confirmed yet — complete payment above
            {deadline
              ? ` by ${format(deadline, "h:mm a")} on ${format(deadline, "d MMM")}`
              : ` within ${HOLD_HOURS} hours`}{" "}
            or the hold will be released.
          </p>
        </div>
        {contactBlock && <div className="mt-3">{contactBlock}</div>}
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl border p-5 shadow-card ${
        isUrgent
          ? "border-gold-500/50 bg-gold-500/15"
          : "border-taupe/20 bg-surface"
      }`}
    >
      {isUrgent && (
        <p className="text-sm font-medium text-ink">
          {daysUntilCheckout === 1
            ? "Your stay wraps up tomorrow morning."
            : "Checkout is today."}{" "}
          Need a bit more time?
        </p>
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="focus-ring flex items-center gap-2 text-sm font-semibold text-terracotta-600 hover:text-terracotta-700"
        >
          <CalendarPlus size={18} />
          Extend My Stay
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <label htmlFor="extraNights" className="text-sm font-medium text-ink/80">
              Extra nights:
            </label>
            <select
              id="extraNights"
              value={nights}
              onChange={(e) => {
                setNights(Number(e.target.value));
                setQuote(null);
              }}
              className="focus-ring rounded-md border border-taupe/25 bg-page px-2 py-1 text-sm text-ink"
            >
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleCheck}
              disabled={checking}
              className="focus-ring rounded-full border border-taupe/25 px-4 py-1.5 text-sm font-semibold text-ink/80 hover:border-terracotta-500 disabled:opacity-60"
            >
              {checking ? "Checking…" : "Check Availability"}
            </button>
          </div>

          {quote && quote.available && (
            <div className="flex items-center justify-between rounded-lg bg-page px-3 py-2 text-sm">
              <span className="text-ink/80">
                +{formatMoney(quote.additionalCost ?? 0, quote.currency ?? "KES")} for {nights} extra night
                {nights > 1 ? "s" : ""}
              </span>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={confirming}
                className="focus-ring rounded-full bg-mocha-500 dark:bg-terracotta-500 px-4 py-1.5 text-xs font-semibold text-mousse dark:text-white hover:bg-mocha-600 dark:hover:bg-terracotta-600 disabled:opacity-60"
              >
                {confirming ? "Confirming…" : "Confirm Extension"}
              </button>
            </div>
          )}

          {quote && !quote.available && (
            <div className="space-y-3">
              <p className="text-sm text-ink/65">{quote.message}</p>

              {quote.alternateRooms && quote.alternateRooms.length > 0 && (
                <div className="space-y-2 rounded-lg bg-page p-3">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-ink/80">
                    <DoorOpen size={16} />
                    Other rooms free for those dates:
                  </p>
                  <ul className="space-y-2">
                    {quote.alternateRooms.map((r) => (
                      <li
                        key={r.roomId}
                        className="flex items-center justify-between gap-3 rounded-lg border border-taupe/20 bg-surface px-3 py-2 text-sm"
                      >
                        <span className="text-ink/80">
                          {r.name} — {formatMoney(r.additionalCost, r.currency)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleTransfer(r.roomId)}
                          disabled={transferringRoomId !== null}
                          className="focus-ring shrink-0 rounded-full bg-mocha-500 dark:bg-terracotta-500 px-4 py-1.5 text-xs font-semibold text-mousse dark:text-white hover:bg-mocha-600 dark:hover:bg-terracotta-600 disabled:opacity-60"
                        >
                          {transferringRoomId === r.roomId ? "Booking…" : "Book this room"}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-ink/55">
                    Booking a different room starts a fresh check-in for those dates — its own door
                    code and WiFi, separate from your current room.
                  </p>
                </div>
              )}

              {contactBlock}
            </div>
          )}

          {error && (
            <div className="space-y-3">
              <p role="alert" className="flex items-center gap-2 text-sm text-danger">
                <Warning size={16} /> {error}
              </p>
              {contactBlock}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
