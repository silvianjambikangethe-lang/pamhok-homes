"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, DeviceMobile } from "@phosphor-icons/react";

export default function WhatsappSetupForm({
  initialPhone,
  required,
}: {
  initialPhone: string | null;
  required: boolean;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/admin/whatsapp-number", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ whatsappPhone: phone }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not save number.");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    if (required) {
      router.push("/admin");
      router.refresh();
    } else {
      setSaved(true);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto max-w-sm rounded-2xl border border-taupe/20 bg-surface p-8 shadow-warm"
    >
      <div className="flex justify-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-forest-700 text-white">
          <DeviceMobile size={22} weight="fill" />
        </div>
      </div>
      <h1 className="mt-4 text-center font-serif text-2xl font-semibold text-ink">
        {required ? "One quick thing" : "WhatsApp Contact"}
      </h1>
      <p className="mt-1 text-center text-sm text-ink/80">
        {required
          ? "Add your WhatsApp number so guests can message you directly from the site."
          : "Update the number guests use to contact you directly."}
      </p>

      <div className="mt-6">
        <label htmlFor="whatsappPhone" className="text-sm font-medium text-ink/80">
          WhatsApp number
        </label>
        <input
          id="whatsappPhone"
          type="tel"
          required
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            setSaved(false);
          }}
          placeholder="+254 7XX XXX XXX"
          className="focus-ring mt-1.5 w-full rounded-lg border border-taupe/25 bg-page px-3.5 py-2.5 text-sm text-ink"
        />
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <div className="mt-5 flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="focus-ring flex-1 rounded-full bg-mocha-500 dark:bg-terracotta-500 px-6 py-3 text-sm font-semibold text-mousse dark:text-white transition-colors hover:bg-mocha-600 dark:hover:bg-terracotta-600 disabled:opacity-60"
        >
          {submitting ? "Saving…" : required ? "Save & Continue" : "Save"}
        </button>
        {saved && !required && (
          <span className="flex items-center gap-1.5 text-sm font-medium text-success">
            <CheckCircle size={16} weight="fill" /> Saved
          </span>
        )}
      </div>
    </form>
  );
}
