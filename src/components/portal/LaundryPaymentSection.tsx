"use client";

import { useState } from "react";
import { CreditCard, Warning } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import type { DisplayCurrency } from "@/lib/currency";
import CurrencySelector from "@/components/CurrencySelector";
import PaymentNotes from "@/components/portal/PaymentNotes";

// Same Jenga PGW hosted checkout as PaymentSection.tsx (jenga-pgw-initiate,
// with `requestId` selecting the laundry charge instead of the booking).
// Terms acceptance only applies to the booking, already accepted by the time
// laundry is ever priced.
export default function LaundryPaymentSection({
  token,
  requestId,
  amount,
  rates,
}: {
  token: string;
  requestId: string;
  amount: number;
  rates: Record<DisplayCurrency, number>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke("jenga-pgw-initiate", {
        body: { token, requestId },
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
    <div className="mt-3 rounded-xl border border-terracotta-300 bg-terracotta-50/60 p-4 dark:border-terracotta-700/40 dark:bg-terracotta-700/10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-ink">Laundry payment due</span>
        <CurrencySelector amountKes={amount} rates={rates} />
      </div>

      <button
        type="button"
        onClick={handlePay}
        disabled={loading}
        className="focus-ring mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-mocha-500 dark:bg-terracotta-500 px-6 py-3 text-sm font-semibold text-mousse dark:text-white transition-colors hover:bg-mocha-600 dark:hover:bg-terracotta-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <CreditCard size={18} />
        {loading ? "Starting…" : "Pay with M-Pesa or card"}
      </button>
      <PaymentNotes />
      {error && (
        <p role="alert" className="mt-2 flex items-center gap-2 text-sm text-danger">
          <Warning size={16} /> {error}
        </p>
      )}
    </div>
  );
}
