"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const guess = guessCurrencyFromLocale(navigator.language);
    setCurrency(guess);
    onChange?.(guess);
    // Only guess once on mount — after that, the guest's manual choice wins.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(next: DisplayCurrency) {
    setCurrency(next);
    onChange?.(next);
  }

  return (
    <div className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 ${className}`}>
      <span className="font-serif text-price text-ink">{formatMoney(amountKes, "KES")}</span>
      {currency !== "KES" && (
        <span className="text-small text-ink/65">
          (approx. {formatMoney(amountKes * (rates[currency] ?? 1), currency)})
        </span>
      )}
      <select
        value={currency}
        onChange={(e) => handleChange(e.target.value as DisplayCurrency)}
        aria-label="Display currency"
        className="focus-ring ml-1 rounded-md border border-gold-500/25 bg-page px-1.5 py-0.5 text-small text-ink/80"
      >
        {OPTIONS.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  );
}
