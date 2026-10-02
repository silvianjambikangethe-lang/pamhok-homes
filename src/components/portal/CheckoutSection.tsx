"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, ClockCountdown } from "@phosphor-icons/react";
import ReviewPrompt from "@/components/portal/ReviewPrompt";
import { GIFT_THRESHOLD } from "@/components/portal/ReviewForm";

// Easy to extend later (trash out, windows closed, etc.) without
// restructuring, just add another string.
const CHECKLIST = [
  "Lights turned off",
  "Room locked",
  "Keys placed in the keybox",
];

// Two separate cards: the "remember me" question first (it dismisses itself
// the moment the guest picks Yes or No), then the check-out checklist and
// button. The answer to the first is sent with the check-out, so both live
// in this one component.
export default function CheckoutSection({
  token,
  isCheckoutDay,
  savedRememberMe,
  onRememberChoice,
}: {
  token: string;
  isCheckoutDay: boolean;
  // The answer already on file (saved earlier this stay, or the guest is
  // already remembered). Non-null means the question is settled and the card
  // is never shown, however many times the page reloads.
  savedRememberMe: boolean | null;
  // Told the moment the guest picks Yes or No, so the page can react (the
  // welcome tag) without waiting for a refresh.
  onRememberChoice?: (choice: boolean) => void;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState<boolean[]>(CHECKLIST.map(() => false));
  const [rememberMe, setRememberMe] = useState<boolean | null>(savedRememberMe);
  const [submitting, setSubmitting] = useState(false);
  const [checkedOut, setCheckedOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allChecked = checked.every(Boolean);

  async function handleConfirm() {
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/portal/${token}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rememberMe }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Could not confirm check-out.");
        setSubmitting(false);
        return;
      }
      // The check-out itself is done. The page refresh (which unmounts this
      // section and shows the thank-you card) waits until the guest has
      // answered the review card below, so it can appear right under the
      // button instead of being swept away by the refresh.
      setCheckedOut(true);
      setSubmitting(false);
    } catch {
      setError("Could not confirm check-out.");
      setSubmitting(false);
    }
  }

  // Save the answer straight away (not just at check-out) so the card stays
  // gone after any reload, e.g. coming back from a laundry payment. If saving
  // fails the choice is still kept locally and sent with the check-out.
  function chooseRememberMe(choice: boolean) {
    setRememberMe(choice);
    onRememberChoice?.(choice);
    void fetch(`/api/portal/${token}/remember-me`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ choice }),
    }).catch(() => {});
  }

  const choiceClass = (selected: boolean) =>
    `focus-ring rounded-full border px-5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
      selected
        ? "border-pk-primary bg-pk-primary text-pk-on-dark dark:border-terracotta-500 dark:bg-terracotta-500 dark:text-white"
        : "border-taupe/25 bg-page text-ink/80 hover:border-terracotta-300"
    }`;

  return (
    <>
      {rememberMe === null && (
        <div className="rounded-2xl border border-taupe/20 bg-surface p-6 shadow-card">
          <h2 className="font-serif text-h3 text-ink">Faster next time</h2>
          <p className="mt-1 text-sm text-ink/80">
            Save your name, email &amp; phone number for a faster, ID-free booking next time?
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => chooseRememberMe(true)}
              aria-pressed={false}
              className={choiceClass(false)}
            >
              Yes, remember me
            </button>
            <button
              type="button"
              onClick={() => chooseRememberMe(false)}
              aria-pressed={false}
              className={choiceClass(false)}
            >
              No
            </button>
          </div>
        </div>
      )}

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
                  disabled={checkedOut}
                  onChange={(e) =>
                    setChecked((prev) => prev.map((v, idx) => (idx === i ? e.target.checked : v)))
                  }
                  className="h-5 w-5 rounded border-taupe/30 accent-terracotta-500 focus:ring-terracotta-500"
                />
                {item}
              </label>
            </li>
          ))}
        </ul>

        {rememberMe === null && !checkedOut && (
          <p className="mt-4 text-sm text-ink/65">
            Choose Yes or No in the card above to continue.
          </p>
        )}
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <button
          type="button"
          onClick={handleConfirm}
          disabled={!allChecked || rememberMe === null || submitting || checkedOut}
          className="focus-ring mt-5 inline-flex items-center gap-2 rounded-full bg-mocha-500 dark:bg-terracotta-500 px-6 py-3 text-sm font-semibold text-mousse dark:text-white transition-colors hover:bg-mocha-600 dark:hover:bg-terracotta-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCircle size={18} weight="fill" />
          {checkedOut ? "Checked Out" : submitting ? "Confirming…" : "Confirm Check-Out"}
        </button>

        {checkedOut && (
          <div className="mt-5">
            {/* Closing the card (the X) or sending a review is what finally
                refreshes the page into its checked-out state. */}
            <ReviewPrompt
              token={token}
              onClose={() => router.refresh()}
              onSubmitted={(rating) => {
                // A 4.8-5 star review plays a ~18s thank-you gift animation
                // (see ThankYouGift) before its own replay button appears —
                // refreshing the page any sooner than that would unmount it
                // mid-animation.
                const delay = rating >= GIFT_THRESHOLD ? 19000 : 2500;
                window.setTimeout(() => router.refresh(), delay);
              }}
            />
          </div>
        )}
      </div>
    </>
  );
}
