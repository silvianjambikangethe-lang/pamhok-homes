"use client";

import { useState } from "react";
import Link from "next/link";
import { CreditCard, DeviceMobile, Warning } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import type { PaymentStatus } from "@/lib/supabase/types";
import type { DisplayCurrency } from "@/lib/currency";
import CurrencySelector from "@/components/CurrencySelector";
import PaymentNotes from "@/components/portal/PaymentNotes";

// Payment goes through Jenga PGW's hosted checkout (jenga-pgw-initiate): the
// guest is redirected to Jenga's page and picks M-Pesa/Equitel or card there.
// The merchant is subscribed to PGW Mobile Money + Card — not the raw STK
// push API — so there is no in-app STK form. PayPal was removed 2026-09-22.
export default function PaymentSection({
  token,
  totalAmount,
  paymentStatus,
  rates,
  termsAlreadyAccepted = false,
}: {
  token: string;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  rates: Record<DisplayCurrency, number>;
  // True when the guest already ticked Terms and Privacy on the booking
  // card (returning guest), so payment is one tap with no second tick.
  termsAlreadyAccepted?: boolean;
}) {
  // Which button was pressed ("mpesa" | "card") while the request is in flight.
  const [loading, setLoading] = useState<"mpesa" | "card" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(termsAlreadyAccepted);

  if (paymentStatus === "Paid") return null;

  async function handlePay(method: "mpesa" | "card") {
    if (!agreedToTerms) return;
    setLoading(method);
    setError(null);

    try {
      const supabase = createClient();
      // Fail fast on a slow/stalled connection (seen on mobile) instead of
      // waiting on the browser's own, much longer, native timeout.
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      let data, fnError;
      try {
        ({ data, error: fnError } = await supabase.functions.invoke("jenga-pgw-initiate", {
          body: { token, termsAccepted: agreedToTerms, method },
          signal: controller.signal,
        }));
      } finally {
        clearTimeout(timeoutId);
      }

      if (fnError || data?.error || !data?.redirectUrl) {
        setError(data?.error ?? "Could not start payment. Please try again.");
        setLoading(null);
        return;
      }

      window.location.href = data.redirectUrl;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setError("The payment page took too long to load. Please check your connection and try again.");
      } else {
        setError("Could not reach the payment service.");
      }
      setLoading(null);
    }
  }

  return (
    <div className="rounded-2xl border border-terracotta-300 bg-terracotta-50/60 p-6 shadow-card dark:border-terracotta-700/40 dark:bg-terracotta-700/10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-h3 text-ink">
          Complete your payment
        </h2>
        <CurrencySelector amountKes={totalAmount} rates={rates} />
      </div>
      <p className="mt-1 text-sm text-ink/80">
        Choose M-Pesa or card, then finish on Jenga&apos;s secure page. Jenga may add a
        small processing fee, shown before you pay. Your dates are secured once payment is complete.
      </p>

      <label
        className={`mt-5 items-start gap-2.5 text-sm text-ink/80 ${termsAlreadyAccepted ? "hidden" : "flex"}`}
      >
        <input
          type="checkbox"
          checked={agreedToTerms}
          onChange={(e) => setAgreedToTerms(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-taupe/40 accent-terracotta-500 focus-visible:ring-2 focus-visible:ring-terracotta-500"
        />
        <span>
          I have read and agree to the{" "}
          <Link
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring rounded text-terracotta-600 underline hover:text-terracotta-700"
          >
            Terms & Conditions
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring rounded text-terracotta-600 underline hover:text-terracotta-700"
          >
            Privacy Policy
          </Link>
        </span>
      </label>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => handlePay("mpesa")}
          disabled={loading !== null || !agreedToTerms}
          className="focus-ring flex w-full items-center justify-center gap-2 rounded-full bg-mocha-500 dark:bg-terracotta-500 px-6 py-3 text-sm font-semibold text-mousse dark:text-white transition-colors hover:bg-mocha-600 dark:hover:bg-terracotta-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <DeviceMobile size={18} />
          {loading === "mpesa" ? "Starting…" : "Pay with M-Pesa"}
        </button>
        <button
          type="button"
          onClick={() => handlePay("card")}
          disabled={loading !== null || !agreedToTerms}
          className="focus-ring flex w-full items-center justify-center gap-2 rounded-full border-2 border-mocha-500 dark:border-terracotta-500 bg-transparent px-6 py-3 text-sm font-semibold text-mocha-500 dark:text-terracotta-400 transition-colors hover:bg-mocha-500/10 dark:hover:bg-terracotta-500/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <CreditCard size={18} />
          {loading === "card" ? "Starting…" : "Pay with card"}
        </button>
      </div>
      <PaymentNotes />
      {error && (
        <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-danger">
          <Warning size={16} /> {error}
        </p>
      )}
    </div>
  );
}
