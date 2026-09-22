"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DeviceMobile, Warning } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import type { PaymentStatus } from "@/lib/supabase/types";
import type { DisplayCurrency } from "@/lib/currency";
import CurrencySelector from "@/components/CurrencySelector";

// M-Pesa (via Jenga) only. PayPal was removed 2026-09-22 — it had been
// switched off since a 2026-09-13 account restriction and was never
// re-enabled; a Jenga card option is planned separately once the right
// Jenga product/credentials are confirmed.
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
  const router = useRouter();
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>("KES");
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awaitingMpesa, setAwaitingMpesa] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  if (paymentStatus === "Paid") return null;

  async function handleMpesa(e: React.FormEvent) {
    e.preventDefault();
    if (!agreedToTerms) return;
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke("mpesa-initiate", {
        body: { token, phone: mpesaPhone, termsAccepted: agreedToTerms },
      });

      if (fnError || data?.error) {
        setError(data?.error ?? "Could not start M-Pesa payment. Please try again.");
        setLoading(false);
        return;
      }

      setAwaitingMpesa(true);
      setLoading(false);

      pollRef.current = setInterval(async () => {
        const res = await fetch(`/api/portal/${token}/status`);
        if (!res.ok) return;
        const status = await res.json();
        if (status.payment_status === "Paid" || status.payment_status === "Failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          setAwaitingMpesa(false);
          if (status.payment_status === "Failed") {
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
    <div className="rounded-2xl border border-terracotta-300 bg-terracotta-50/60 p-6 shadow-card dark:border-terracotta-700/40 dark:bg-terracotta-700/10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-h3 text-ink">
          Complete your payment
        </h2>
        <CurrencySelector amountKes={totalAmount} rates={rates} onChange={setDisplayCurrency} />
      </div>
      <p className="mt-1 text-sm text-ink/80">
        Pay with M-Pesa. Your room stays reserved.
      </p>

      <label className="mt-5 flex items-start gap-2.5 text-sm text-ink/80">
        <input
          type="checkbox"
          checked={agreedToTerms}
          onChange={(e) => setAgreedToTerms(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-taupe/40 text-terracotta-500 focus-visible:ring-2 focus-visible:ring-terracotta-500"
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

      {awaitingMpesa ? (
        <p className="mt-5 flex items-center gap-2 text-sm font-medium text-ink">
          <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
          Check your phone and enter your M-Pesa PIN to complete payment…
        </p>
      ) : (
        <form onSubmit={handleMpesa} className="mt-5 space-y-3">
          <label htmlFor="mpesaPhone" className="flex items-center gap-2 text-sm font-semibold text-ink/80">
            <DeviceMobile size={18} />
            M-Pesa phone number
          </label>
          <div className="flex gap-2">
            <input
              id="mpesaPhone"
              type="tel"
              required
              maxLength={20}
              value={mpesaPhone}
              onChange={(e) => setMpesaPhone(e.target.value)}
              className="focus-ring flex-1 rounded-lg border border-taupe/25 bg-page px-3.5 py-2.5 text-sm text-ink"
            />
            <button
              type="submit"
              disabled={loading || !agreedToTerms}
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
