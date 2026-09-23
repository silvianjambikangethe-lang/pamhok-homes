"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DeviceMobile, Warning } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import type { DisplayCurrency } from "@/lib/currency";
import CurrencySelector from "@/components/CurrencySelector";

// M-Pesa (via Jenga) only — see PaymentSection.tsx for why PayPal was
// removed (2026-09-22). Same shape as that component, scoped to one
// laundry request instead of the booking itself — kept separate since the
// two have different backing endpoints (guest_requests.laundry_* fields
// here, bookings.payment_* there) and terms-acceptance only applies to
// the booking (already accepted by the time laundry is ever priced).
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
  const router = useRouter();
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awaitingMpesa, setAwaitingMpesa] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function handleMpesa(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke(
        "mpesa-initiate-laundry",
        { body: { token, requestId, phone: mpesaPhone } },
      );

      if (fnError || data?.error) {
        setError(data?.error ?? "Could not start M-Pesa payment. Please try again.");
        setLoading(false);
        return;
      }

      setAwaitingMpesa(true);
      setLoading(false);

      pollRef.current = setInterval(async () => {
        const res = await fetch(`/api/portal/${token}/laundry/${requestId}/status`);
        if (!res.ok) return;
        const status = await res.json();
        if (status.laundry_payment_status === "Paid" || status.laundry_payment_status === "Failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          setAwaitingMpesa(false);
          if (status.laundry_payment_status === "Failed") {
            setError("Payment did not go through. Please try again.");
          }
          router.refresh();
        }
      }, 3000);
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

      {awaitingMpesa ? (
        <p className="mt-3 flex items-center gap-2 text-sm font-medium text-ink">
          <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
          Check your phone and enter your M-Pesa PIN to complete payment…
        </p>
      ) : (
        <form onSubmit={handleMpesa} className="mt-3 space-y-2">
          <label htmlFor="laundryMpesaPhone" className="flex items-center gap-2 text-sm font-medium text-ink/80">
            <DeviceMobile size={18} />
            M-Pesa phone number
          </label>
          <div className="flex gap-2">
            <input
              id="laundryMpesaPhone"
              type="tel"
              required
              maxLength={20}
              value={mpesaPhone}
              onChange={(e) => setMpesaPhone(e.target.value)}
              className="focus-ring flex-1 rounded-lg border border-taupe/25 bg-page px-3.5 py-2.5 text-sm text-ink"
            />
            <button
              type="submit"
              disabled={loading}
              className="focus-ring shrink-0 rounded-lg bg-success px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Sending…" : "Send STK Push"}
            </button>
          </div>
          {error && (
            <p role="alert" className="flex items-center gap-2 text-sm text-danger">
              <Warning size={16} /> {error}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
