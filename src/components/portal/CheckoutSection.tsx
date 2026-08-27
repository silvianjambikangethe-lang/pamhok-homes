"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, ClockCountdown } from "@phosphor-icons/react";

// Easy to extend later (trash out, windows closed, etc.) without
// restructuring — just add another string.
const CHECKLIST = [
  "Lights turned off",
  "Room locked",
  "Keys placed in the keybox",
];

export default function CheckoutSection({
  token,
  isCheckoutDay,
}: {
  token: string;
  isCheckoutDay: boolean;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState<boolean[]>(CHECKLIST.map(() => false));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allChecked = checked.every(Boolean);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/portal/${token}/checkout`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Could not confirm check-out.");
        setSubmitting(false);
        return;
      }
      router.refresh();
      // This section unmounts once the refreshed booking shows
      // checked_out_at set, but resetting here too avoids a stuck
      // "Confirming…" button if that refresh is ever slow to land.
      setSubmitting(false);
    } catch {
      setError("Could not confirm check-out.");
      setSubmitting(false);
    }
  }

  return (
    <div
      className={`rounded-2xl border p-6 shadow-card ${
        isCheckoutDay
          ? "border-gold-500/50 bg-gold-500/15"
          : "border-taupe/20 bg-surface"
      }`}
    >
      <div className="flex items-center gap-2">
        {isCheckoutDay && <ClockCountdown size={22} className="text-gold-700 dark:text-gold-300" />}
        <h2 className="font-serif text-h3 text-ink">
          {isCheckoutDay ? "Today is your check-out day" : "Checking out early?"}
        </h2>
      </div>
      <p className="mt-1 text-sm text-ink/80">
        Please complete this checklist before you head out.
      </p>

      <ul className="mt-4 space-y-2">
        {CHECKLIST.map((item, i) => (
          <li key={item}>
            <label className="flex cursor-pointer items-center gap-3 text-sm text-ink/80">
              <input
                type="checkbox"
                checked={checked[i]}
                onChange={(e) =>
                  setChecked((prev) => prev.map((v, idx) => (idx === i ? e.target.checked : v)))
                }
                className="h-5 w-5 rounded border-taupe/30 text-terracotta-500 focus:ring-terracotta-500"
              />
              {item}
            </label>
          </li>
        ))}
      </ul>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <button
        type="button"
        onClick={handleConfirm}
        disabled={!allChecked || submitting}
        className="focus-ring mt-5 inline-flex items-center gap-2 rounded-full bg-mocha-500 dark:bg-terracotta-500 px-6 py-3 text-sm font-semibold text-mousse dark:text-white transition-colors hover:bg-mocha-600 dark:hover:bg-terracotta-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <CheckCircle size={18} weight="fill" />
        {submitting ? "Confirming…" : "Confirm Check-Out"}
      </button>
    </div>
  );
}
