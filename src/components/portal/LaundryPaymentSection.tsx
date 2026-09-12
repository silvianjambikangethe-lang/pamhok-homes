"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, DeviceMobile, Warning } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import type { DisplayCurrency } from "@/lib/currency";
import CurrencySelector from "@/components/CurrencySelector";

type Method = "mpesa" | "paypal";

// Same shape as PaymentSection (the booking-payment equivalent), scoped
// to one laundry request instead of the booking itself — kept as a
// separate component rather than a generalized shared one, since the
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
  const [activeMethod, setActiveMethod] = useState<Method | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>("KES");
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [loading, setLoading] = useState<Method | null>(null);
  const [error, setError] = useState<Record<Method, string | null>>({
    mpesa: null,
    paypal: null,
  });
  const [awaitingMpesa, setAwaitingMpesa] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function setMethodError(method: Method, message: string | null) {
    setError((prev) => ({ ...prev, [method]: message }));
  }

  async function handleMpesa(e: React.FormEvent) {
    e.preventDefault();
    setLoading("mpesa");
    setMethodError("mpesa", null);

    try {
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke(
        "mpesa-initiate-laundry",
        { body: { token, requestId, phone: mpesaPhone } },
      );

      if (fnError || data?.error) {
        setMethodError(
          "mpesa",
          data?.error ?? "Could not start M-Pesa payment. Please try again.",
        );
        setLoading(null);
        return;
      }

      setAwaitingMpesa(true);
      setLoading(null);

      pollRef.current = setInterval(async () => {
        const res = await fetch(`/api/portal/${token}/laundry/${requestId}/status`);
        if (!res.ok) return;
        const status = await res.json();
        if (status.laundry_payment_status === "Paid" || status.laundry_payment_status === "Failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          setAwaitingMpesa(false);
          if (status.laundry_payment_status === "Failed") {
            setMethodError("mpesa", "Payment did not go through. Please try again.");
          }
          router.refresh();
        }
      }, 3000);
    } catch {
      setMethodError("mpesa", "Could not reach the payment service.");
      setLoading(null);
    }
  }

  async function handlePaypalPayment() {
    setLoading("paypal");
    setMethodError("paypal", null);

    try {
      const res = await fetch(`/api/portal/${token}/laundry/${requestId}/paypal/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency: displayCurrency }),
      });
      const data = await res.json();

      if (!res.ok || !data.url) {
        setMethodError(
          "paypal",
          data.configured === false
            ? "Payment method not yet configured."
            : (data.error ?? "Could not start checkout."),
        );
        setLoading(null);
        return;
      }

      window.location.href = data.url;
    } catch {
      setMethodError("paypal", "Could not reach the payment service.");
      setLoading(null);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-terracotta-300 bg-terracotta-50/60 p-4 dark:border-terracotta-700/40 dark:bg-terracotta-700/10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-ink">Laundry payment due</span>
        <CurrencySelector amountKes={amount} rates={rates} onChange={setDisplayCurrency} />
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setActiveMethod("mpesa")}
          className={`focus-ring flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
            activeMethod === "mpesa"
              ? "border-success bg-success text-white"
              : "border-taupe/25 bg-page text-ink/80 hover:border-success"
          }`}
        >
          <DeviceMobile size={18} />
          M-Pesa
        </button>
        <button
          type="button"
          onClick={handlePaypalPayment}
          disabled={loading === "paypal"}
          className="focus-ring flex items-center justify-center gap-2 rounded-xl border border-taupe/25 bg-page px-4 py-2.5 text-sm font-semibold text-ink/80 transition-colors hover:border-forest-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CreditCard size={18} weight="fill" />
          {loading === "paypal" ? "Redirecting…" : "PayPal / Card"}
        </button>
      </div>

      {error.paypal && (
        <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-danger">
          <Warning size={16} /> {error.paypal}
        </p>
      )}

      {activeMethod === "mpesa" && (
        <form onSubmit={handleMpesa} className="mt-4 space-y-2 border-t border-taupe/20 pt-4">
          {awaitingMpesa ? (
            <p className="flex items-center gap-2 text-sm font-medium text-ink">
              <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
              Check your phone and enter your M-Pesa PIN to complete payment…
            </p>
          ) : (
            <>
              <label htmlFor="laundryMpesaPhone" className="text-sm font-medium text-ink/80">
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
                  disabled={loading === "mpesa"}
                  className="focus-ring shrink-0 rounded-lg bg-success px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading === "mpesa" ? "Sending…" : "Send STK Push"}
                </button>
              </div>
              {error.mpesa && (
                <p role="alert" className="flex items-center gap-2 text-sm text-danger">
                  <Warning size={16} /> {error.mpesa}
                </p>
              )}
            </>
          )}
        </form>
      )}
    </div>
  );
}
