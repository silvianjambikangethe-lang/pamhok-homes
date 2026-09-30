"use client";

import { useEffect, useRef, useState } from "react";
import { CreditCard } from "@phosphor-icons/react";

export default function PaymentNavigationGuard() {
  const [showModal, setShowModal] = useState(false);
  const allowNavigate = useRef(false);

  useEffect(() => {
    // Push a guard entry on top of the current portal history entry.
    // Now history looks like: [..., rooms_page, portal_page, guard_entry]
    history.pushState({ paymentGuard: true }, "");

    function handlePopState() {
      if (allowNavigate.current) return;
      // User pressed back — re-push the guard so the stack stays consistent,
      // then show the modal. History: [..., rooms_page, portal_page, guard]
      history.pushState({ paymentGuard: true }, "");
      setShowModal(true);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function handleComplete() {
    setShowModal(false);
  }

  function handleCancel() {
    allowNavigate.current = true;
    setShowModal(false);
    // Go back 2 steps: past the re-pushed guard and past the portal entry,
    // landing on the rooms page the guest came from.
    history.go(-2);
  }

  if (!showModal) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Complete your payment"
      className="fixed inset-0 z-50 flex items-center justify-center bg-espresso/60 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-2xl border border-taupe/20 bg-surface p-7 shadow-warm">
        <CreditCard size={32} weight="duotone" className="text-terracotta-600" />
        <h2 className="mt-3 font-serif text-h2 text-ink">
          Complete your payment?
        </h2>
        <p className="mt-2 text-sm text-ink/70">
          You haven&apos;t finished paying yet — your room is still held for
          you. Head back to complete it now.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleComplete}
            className="focus-ring flex w-full items-center justify-center gap-2 rounded-full bg-mocha-500 dark:bg-terracotta-500 px-6 py-3 text-sm font-semibold text-mousse dark:text-white transition-colors hover:bg-mocha-600 dark:hover:bg-terracotta-600"
          >
            <CreditCard size={16} weight="bold" />
            Complete Payment
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="focus-ring w-full rounded-full border border-taupe/30 px-6 py-3 text-sm font-semibold text-ink/70 transition-colors hover:border-terracotta-300 hover:text-ink"
          >
            Cancel — change rooms
          </button>
        </div>
      </div>
    </div>
  );
}
