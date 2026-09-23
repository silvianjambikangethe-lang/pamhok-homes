"use client";

import { useEffect, useId, useRef, useState } from "react";
import { CaretDown, Check } from "@phosphor-icons/react";
import type { DisplayCurrency } from "@/lib/currency";
import { formatMoney, guessCurrencyFromLocale } from "@/lib/currency-format";

const OPTIONS: DisplayCurrency[] = ["KES", "USD", "EUR", "GBP"];

export default function CurrencySelector({
  amountKes,
  rates,
  onChange,
  className = "",
}: {
  amountKes: number;
  rates: Record<DisplayCurrency, number>;
  onChange?: (currency: DisplayCurrency) => void;
  className?: string;
}) {
  const [currency, setCurrency] = useState<DisplayCurrency>("KES");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const guess = guessCurrencyFromLocale(navigator.language);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time locale guess, not a render sync
    setCurrency(guess);
    onChange?.(guess);
    // Only guess once on mount — after that, the guest's manual choice wins.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close on a click outside the dropdown.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  // Move focus into the list when it opens so the arrow keys work.
  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  function handleChange(next: DisplayCurrency) {
    setCurrency(next);
    onChange?.(next);
  }

  function openList() {
    setActiveIndex(Math.max(0, OPTIONS.indexOf(currency)));
    setOpen(true);
  }

  function choose(index: number) {
    handleChange(OPTIONS[index]);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function onListKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % OPTIONS.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + OPTIONS.length) % OPTIONS.length);
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(OPTIONS.length - 1);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(activeIndex);
    } else if (e.key === "Escape" || e.key === "Tab") {
      setOpen(false);
      if (e.key === "Escape") buttonRef.current?.focus();
    }
  }

  return (
    <div className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 ${className}`}>
      <span className="font-serif text-price text-ink">{formatMoney(amountKes, "KES")}</span>
      {currency !== "KES" && (
        <span className="text-small text-ink/65">
          (approx. {formatMoney(amountKes * (rates[currency] ?? 1), currency)})
        </span>
      )}

      <div ref={wrapperRef} className="relative ml-1 self-center">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => (open ? setOpen(false) : openList())}
          aria-label="Display currency"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-taupe/40 bg-pk-surface px-3 py-1 text-small font-semibold text-ink transition-colors hover:bg-pk-sunken dark:bg-page dark:hover:bg-surface"
        >
          {currency}
          <CaretDown size={12} weight="bold" aria-hidden="true" />
        </button>

        {open && (
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-label="Display currency"
            aria-activedescendant={`${listId}-${activeIndex}`}
            onKeyDown={onListKeyDown}
            className="absolute left-0 z-20 mt-2 min-w-[7rem] rounded-xl border border-taupe/25 bg-pk-surface p-1 shadow-warm outline-none dark:bg-surface"
          >
            {OPTIONS.map((c, i) => {
              const selected = c === currency;
              const active = i === activeIndex;
              return (
                <li
                  key={c}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => choose(i)}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm text-ink ${
                    active
                      ? "bg-pk-latte dark:bg-terracotta-700/25 dark:text-terracotta-300"
                      : ""
                  } ${selected ? "font-semibold" : ""}`}
                >
                  {c}
                  {selected && <Check size={14} weight="bold" aria-hidden="true" />}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
