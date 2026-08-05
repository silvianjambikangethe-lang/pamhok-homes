"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { differenceInCalendarDays, parseISO, startOfDay } from "date-fns";
import { CalendarPlus, Warning } from "@phosphor-icons/react";

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ExtendStaySection({
  token,
  checkOut,
}: {
  token: string;
  checkOut: string;
}) {
  const router = useRouter();
  const daysUntilCheckout = differenceInCalendarDays(startOfDay(parseISO(checkOut)), startOfDay(new Date()));

  const [open, setOpen] = useState(false);
  const [nights, setNights] = useState(1);
  const [quote, setQuote] = useState<{ available: boolean; additionalCost?: number; currency?: string; message?: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [confirming, setConfirming] = useState(false);
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
    } catch {
      setError("Could not extend your stay.");
      setConfirming(false);
    }
  }

  const isUrgent = daysUntilCheckout <= 1;

  return (
    <div
      className={`rounded-2xl border p-5 shadow-card ${
        isUrgent
          ? "border-gold-500/50 bg-gold-500/15"
          : "border-gold-500/20 bg-surface"
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
              className="focus-ring rounded-md border border-gold-500/25 bg-page px-2 py-1 text-sm text-ink"
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
              className="focus-ring rounded-full border border-gold-500/25 px-4 py-1.5 text-sm font-semibold text-ink/80 hover:border-terracotta-500 disabled:opacity-60"
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
                className="focus-ring rounded-full bg-terracotta-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-terracotta-600 disabled:opacity-60"
              >
                {confirming ? "Confirming…" : "Confirm Extension"}
              </button>
            </div>
          )}
          {quote && !quote.available && (
            <p className="text-sm text-ink/65">{quote.message}</p>
          )}
          {error && (
            <p role="alert" className="flex items-center gap-2 text-sm text-danger">
              <Warning size={16} /> {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
