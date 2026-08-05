"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreditCard, DeviceMobile, Warning } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import type { PaymentStatus } from "@/lib/supabase/types";
import type { DisplayCurrency } from "@/lib/currency";
import CurrencySelector from "@/components/CurrencySelector";

type Method = "mpesa" | "paypal";

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
  const [activeMethod, setActiveMethod] = useState<Method | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>("KES");
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [loading, setLoading] = useState<Method | null>(null);
  const [error, setError] = useState<Record<Method, string | null>>({
    mpesa: null,
    paypal: null,
  });
  const [awaitingMpesa, setAwaitingMpesa] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  if (paymentStatus === "Paid") return null;

  function setMethodError(method: Method, message: string | null) {
    setError((prev) => ({ ...prev, [method]: message }));
  }

  async function handleMpesa(e: React.FormEvent) {
    e.preventDefault();
    if (!agreedToTerms) return;
    setLoading("mpesa");
    setMethodError("mpesa", null);

    try {
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke("mpesa-initiate", {
        body: { token, phone: mpesaPhone, termsAccepted: agreedToTerms },
      });

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
        const res = await fetch(`/api/portal/${token}/status`);
        if (!res.ok) return;
        const status = await res.json();
        if (status.payment_status === "Paid" || status.payment_status === "Failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          setAwaitingMpesa(false);
          if (status.payment_status === "Failed") {
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
    if (!agreedToTerms) return;
    setLoading("paypal");
    setMethodError("paypal", null);

    try {
      const res = await fetch("/api/payments/paypal/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, currency: displayCurrency, termsAccepted: agreedToTerms }),
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
    <div className="rounded-2xl border border-terracotta-300 bg-terracotta-50/60 p-6 shadow-card dark:border-terracotta-700/40 dark:bg-terracotta-700/10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-h3 text-ink">
          Complete your payment
        </h2>
        <CurrencySelector amountKes={totalAmount} rates={rates} onChange={setDisplayCurrency} />
      </div>
      <p className="mt-1 text-sm text-ink/80">
        Choose how you&apos;d like to pay. Your room stays reserved.
      </p>

      <label className="mt-5 flex items-start gap-2.5 text-sm text-ink/80">
        <input
          type="checkbox"
          checked={agreedToTerms}
          onChange={(e) => setAgreedToTerms(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-gold-500/40 text-terracotta-500 focus-visible:ring-2 focus-visible:ring-terracotta-500"
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

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setActiveMethod("mpesa")}
          disabled={!agreedToTerms}
          className={`focus-ring flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            activeMethod === "mpesa"
              ? "border-success bg-success text-white"
              : "border-gold-500/25 bg-page text-ink/80 hover:border-success"
          }`}
        >
          <DeviceMobile size={18} />
          M-Pesa
        </button>
        <button
          type="button"
          onClick={handlePaypalPayment}
          disabled={loading === "paypal" || !agreedToTerms}
          className="focus-ring flex items-center justify-center gap-2 rounded-xl border border-gold-500/25 bg-page px-4 py-3 text-sm font-semibold text-ink/80 transition-colors hover:border-forest-500 disabled:cursor-not-allowed disabled:opacity-50"
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
        <form onSubmit={handleMpesa} className="mt-5 space-y-3 border-t border-gold-500/20 pt-5">
          {awaitingMpesa ? (
            <p className="flex items-center gap-2 text-sm font-medium text-ink">
              <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
              Check your phone and enter your M-Pesa PIN to complete payment…
            </p>
          ) : (
            <>
              <label htmlFor="mpesaPhone" className="text-sm font-medium text-ink/80">
                M-Pesa phone number
              </label>
              <div className="flex gap-2">
                <input
                  id="mpesaPhone"
                  type="tel"
                  required
                  value={mpesaPhone}
                  onChange={(e) => setMpesaPhone(e.target.value)}
                  placeholder="07XX XXX XXX"
                  className="focus-ring flex-1 rounded-lg border border-gold-500/25 bg-page px-3.5 py-2.5 text-sm text-ink"
                />
                <button
                  type="submit"
                  disabled={loading === "mpesa" || !agreedToTerms}
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
