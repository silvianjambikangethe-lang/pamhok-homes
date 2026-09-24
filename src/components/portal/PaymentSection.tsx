"use client";

import { useState } from "react";
import Link from "next/link";
import { CreditCard, Warning } from "@phosphor-icons/react";
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
}: {
  token: string;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  rates: Record<DisplayCurrency, number>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  if (paymentStatus === "Paid") return null;

  async function handlePay() {
    if (!agreedToTerms) return;
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke("jenga-pgw-initiate", {
        body: { token, termsAccepted: agreedToTerms },
      });

      if (fnError || data?.error || !data?.redirectUrl) {
        setError(data?.error ?? "Could not start payment. Please try again.");
        setLoading(false);
        return;
      }

      window.location.href = data.redirectUrl;
    } catch {
      setError("Could not reach the payment service.");
      setLoading(false);
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
        Pay with M-Pesa or card on Jenga&apos;s secure page. Jenga may add a
        small processing fee, shown before you pay. Your room stays reserved.
      </p>

      <label className="mt-5 flex items-start gap-2.5 text-sm text-ink/80">
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

      <button
        type="button"
        onClick={handlePay}
        disabled={loading || !agreedToTerms}
        className="focus-ring mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-mocha-500 dark:bg-terracotta-500 px-6 py-3 text-sm font-semibold text-mousse dark:text-white transition-colors hover:bg-mocha-600 dark:hover:bg-terracotta-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <CreditCard size={18} />
        {loading ? "Starting…" : "Pay with M-Pesa or card"}
      </button>
      <PaymentNotes />
      {error && (
        <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-danger">
          <Warning size={16} /> {error}
        </p>
      )}
    </div>
  );
}
