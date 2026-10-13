"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CHECK_IN_TIME, CHECK_OUT_TIME } from "@/lib/site";

// Shown right after the guest ticks "I agree to the Terms & Privacy Policy"
// on the booking card — a second, separate acceptance (see BookingWidget's
// agreedToTerms + houseRulesAccepted) before the booking can be submitted.
// Content matches the "Pamhok House Rules" design (times, occupancy, not
// permitted, damages, ID note), restyled with the site's own theme tokens
// instead of its own standalone palette.
export default function HouseRulesModal({
  open,
  onAccept,
  onDismiss,
}: {
  open: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  const acceptRef = useRef<HTMLButtonElement>(null);
  // Rendered through a portal straight onto <body> (below), so this can
  // only run once mounted in the browser — avoids the classic SSR
  // "document is not defined" crash and a hydration mismatch.
  const [mounted, setMounted] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- mount flag avoids an SSR "document is not defined" crash
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) acceptRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onDismiss();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onDismiss]);

  // Without this, the page behind keeps scrolling along with the modal
  // (two scrollable things stacked, fighting over wheel/touch input) —
  // part of why the modal could feel like it had "no scroll" of its own.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open || !mounted) return null;

  // Rendered as a portal directly on <body> — not nested inside the
  // booking card/page markup — so this `fixed` overlay is never at the
  // mercy of an ancestor's own stacking context (e.g. the sticky header's
  // own backdrop-blur layer, which some mobile browsers paint above a
  // same-page `position: fixed` descendant regardless of z-index). This
  // guarantees the overlay — and its own scroll — always covers the
  // actual viewport, header included.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="house-rules-title"
      aria-describedby="house-rules-lede"
      className="fixed inset-0 z-50 overflow-y-auto bg-espresso/60 p-4"
      onClick={onDismiss}
    >
      <div className="flex min-h-full items-center justify-center">
      <div
        className="relative w-full max-w-md rounded-2xl border-2 border-terracotta-500 bg-surface p-6 shadow-warm"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-bold uppercase tracking-widest text-terracotta-600">
          Pamhok Homes
        </p>
        <h2 id="house-rules-title" className="mt-1 font-serif text-h2 text-ink">
          House Rules
        </h2>
        <p id="house-rules-lede" className="mt-1 text-sm text-ink/65">
          Please read and accept before continuing.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <div className="rounded-xl border border-taupe/20 bg-page p-3">
            <span className="block text-[11px] font-bold uppercase tracking-wide text-ink/55">
              Check in
            </span>
            <strong className="mt-0.5 block font-serif text-xl text-ink">{CHECK_IN_TIME}</strong>
          </div>
          <div className="rounded-xl border border-taupe/20 bg-page p-3">
            <span className="block text-[11px] font-bold uppercase tracking-wide text-ink/55">
              Check out
            </span>
            <strong className="mt-0.5 block font-serif text-xl text-ink">{CHECK_OUT_TIME}</strong>
          </div>
        </div>

        <div className="mt-2 divide-y divide-taupe/20">
          <div className="grid grid-cols-[100px_1fr] gap-3 py-3.5 sm:grid-cols-[112px_1fr]">
            <h3 className="pt-0.5 text-[11px] font-bold uppercase tracking-wide text-ink/55">
              Occupancy
            </h3>
            <p className="text-sm text-ink/85">
              <b className="rounded bg-terracotta-50 px-1.5 py-0.5 font-semibold text-terracotta-700 dark:bg-terracotta-700/20 dark:text-terracotta-300">
                Maximum of 2 guests
              </b>{" "}
              per unit.
            </p>
          </div>

          <div className="grid grid-cols-[100px_1fr] gap-3 py-3.5 sm:grid-cols-[112px_1fr]">
            <h3 className="pt-0.5 text-[11px] font-bold uppercase tracking-wide text-ink/55">
              Not permitted
            </h3>
            <div className="space-y-1.5 text-sm text-ink/85">
              <p>
                <b className="rounded bg-danger/10 px-1.5 py-0.5 font-semibold text-danger">
                  No parties
                </b>{" "}
                or events.
              </p>
              <p>
                <b className="rounded bg-danger/10 px-1.5 py-0.5 font-semibold text-danger">
                  No pets.
                </b>
              </p>
              <p>
                <b className="rounded bg-danger/10 px-1.5 py-0.5 font-semibold text-danger">
                  No smoking
                </b>{" "}
                of any kind on the premises, including bhang.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-[100px_1fr] gap-3 py-3.5 sm:grid-cols-[112px_1fr]">
            <h3 className="pt-0.5 text-[11px] font-bold uppercase tracking-wide text-ink/55">
              Damages
            </h3>
            <div className="space-y-1.5 text-sm text-ink/85">
              <p>
                Any damage or loss must be{" "}
                <b className="rounded bg-terracotta-50 px-1.5 py-0.5 font-semibold text-terracotta-700 dark:bg-terracotta-700/20 dark:text-terracotta-300">
                  reported to the Host before check out.
                </b>
              </p>
              <p>
                Guests are responsible for any damage to or loss of property as a
                result of their actions, and this will be settled directly with the
                Host.
              </p>
            </div>
          </div>
        </div>

        <p className="mt-2 rounded-xl border border-taupe/20 bg-page p-3.5 text-sm text-ink/80">
          <span className="mr-1.5 text-xs font-bold uppercase tracking-wide text-terracotta-600">
            N.B.
          </span>
          <b className="font-semibold">National identification documents are required</b> to
          complete any booking. This may be a valid passport or a valid national ID. A
          soft copy is sufficient. Documents are used for verification only and kept
          confidential.
        </p>

        <button
          ref={acceptRef}
          type="button"
          onClick={onAccept}
          className="focus-ring mt-4 w-full rounded-full bg-mocha-500 px-6 py-3.5 text-btn text-mousse transition-colors hover:bg-mocha-600 dark:bg-terracotta-500 dark:text-white dark:hover:bg-terracotta-600"
        >
          Yes, I Accept
        </button>
        <p className="mt-3 text-center text-xs text-ink/60">
          By selecting Yes, I Accept, you confirm that you have read and agree to
          these house rules.
        </p>
      </div>
      </div>
    </div>,
    document.body,
  );
}
