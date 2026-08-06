"use client";

import { useState } from "react";
import { CheckCircle, DoorOpen, HandWaving, WifiHigh } from "@phosphor-icons/react";

export default function UnlockedSection({
  token,
  doorCode,
  wifiNetworkName,
  wifiPassword,
  blurred = false,
}: {
  token: string;
  doorCode: string | null;
  wifiNetworkName: string | null;
  wifiPassword: string | null;
  blurred?: boolean;
}) {
  const [message, setMessage] = useState("");
  const [requestType, setRequestType] = useState<"cleaning" | "assistance" | "other">(
    "assistance",
  );
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/portal/${token}/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestType, message }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Could not send your request.");
        setSubmitting(false);
        return;
      }
      setSent(true);
      setMessage("");
      setSubmitting(false);
    } catch {
      setError("Could not send your request.");
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gold-500/20 bg-surface p-6 shadow-card">
      <div className="flex items-center gap-2">
        <CheckCircle size={22} weight="fill" className="text-success" />
        <h2 className="font-serif text-h3 text-ink">
          You&apos;re verified — welcome!
        </h2>
      </div>

      {/* Step 3 (unlocked): Terracotta accent border signals "now active" — same in both themes. */}
      <div className="relative mt-5">
        <div
          className={`grid gap-4 transition-[filter] duration-200 sm:grid-cols-2 ${
            blurred ? "pointer-events-none select-none blur-md" : ""
          }`}
        >
          <div className="rounded-xl border-2 border-terracotta-500 bg-page p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink/80">
              <DoorOpen size={18} className="text-terracotta-600" />
              Door code
            </div>
            <p className="mt-1 font-mono text-2xl tracking-widest text-ink">
              {doorCode ?? "—"}
            </p>
          </div>
          <div className="rounded-xl border-2 border-terracotta-500 bg-page p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink/80">
              <WifiHigh size={18} className="text-terracotta-600" />
              WiFi
            </div>
            {wifiNetworkName && (
              <p className="mt-1 text-sm text-ink/65">
                Network: <span className="font-mono text-ink">{wifiNetworkName}</span>
              </p>
            )}
            <p className="mt-1 font-mono text-2xl tracking-widest text-ink">
              {wifiPassword ?? "—"}
            </p>
          </div>
        </div>
        {blurred && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-espresso/85 px-4 py-1.5 text-center text-xs font-semibold text-ivory shadow-warm">
              Hidden while your arrival pass is shown
            </span>
          </div>
        )}
      </div>

      <div className="mt-6 border-t border-gold-500/20 pt-5">
        {sent ? (
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            <CheckCircle size={18} weight="fill" className="text-success" />
            Request sent — we&apos;ll be in touch shortly.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink/80">
              <HandWaving size={18} />
              Need something?
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { value: "assistance", label: "Assistance" },
                  { value: "cleaning", label: "Cleaning" },
                  { value: "other", label: "Other" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRequestType(opt.value)}
                  className={`focus-ring rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${
                    requestType === opt.value
                      ? "border-terracotta-500 bg-terracotta-500 text-white"
                      : "border-gold-500/25 bg-page text-ink/80"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Tell us what you need…"
              className="focus-ring w-full rounded-lg border border-gold-500/25 bg-page px-3.5 py-2.5 text-sm text-ink"
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="focus-ring rounded-full bg-terracotta-500 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-terracotta-600 disabled:opacity-60"
            >
              {submitting ? "Sending…" : "Call for Assistance"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
