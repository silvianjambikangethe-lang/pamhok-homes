"use client";

import { useState } from "react";
import { CreditCard, DeviceMobile, Warning } from "@phosphor-icons/react";
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
  const [loading, setLoading] = useState<"mpesa" | "card" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePay(method: "mpesa" | "card") {
    setLoading(method);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke("jenga-pgw-initiate", {
        body: { token, requestId, method },
      });

      if (fnError || data?.error || !data?.redirectUrl) {
        setError(data?.error ?? "Could not start payment. Please try again.");
        setLoading(null);
        return;
      }

      window.location.href = data.redirectUrl;
    } catch {
      setError("Could not reach the payment service.");
      setLoading(null);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-terracotta-300 bg-terracotta-50/60 p-4 dark:border-terracotta-700/40 dark:bg-terracotta-700/10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-ink">Laundry payment due</span>
        <CurrencySelector amountKes={amount} rates={rates} />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => handlePay("mpesa")}
          disabled={loading !== null}
          className="focus-ring flex w-full items-center justify-center gap-2 rounded-full bg-mocha-500 dark:bg-terracotta-500 px-6 py-3 text-sm font-semibold text-mousse dark:text-white transition-colors hover:bg-mocha-600 dark:hover:bg-terracotta-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <DeviceMobile size={18} />
          {loading === "mpesa" ? "Starting…" : "Pay with M-Pesa"}
        </button>
        <button
          type="button"
          onClick={() => handlePay("card")}
          disabled={loading !== null}
          className="focus-ring flex w-full items-center justify-center gap-2 rounded-full border-2 border-mocha-500 dark:border-terracotta-500 bg-transparent px-6 py-3 text-sm font-semibold text-mocha-500 dark:text-terracotta-400 transition-colors hover:bg-mocha-500/10 dark:hover:bg-terracotta-500/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <CreditCard size={18} />
          {loading === "card" ? "Starting…" : "Pay with card"}
        </button>
      </div>
      <PaymentNotes />
      {error && (
        <p role="alert" className="mt-2 flex items-center gap-2 text-sm text-danger">
          <Warning size={16} /> {error}
        </p>
      )}
    </div>
  );
}
