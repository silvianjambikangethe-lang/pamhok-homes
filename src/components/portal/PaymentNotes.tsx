import { CaretDown, Question } from "@phosphor-icons/react";

function Option({ children }: { children: React.ReactNode }) {
  return (
    <strong className="rounded bg-terracotta-100 px-1.5 py-0.5 font-bold text-terracotta-700 underline decoration-terracotta-500 decoration-2 underline-offset-4 dark:bg-terracotta-700/40 dark:text-terracotta-300">
      {children}
    </strong>
  );
}

export default function PaymentNotes() {
  return (
    <details className="group mt-4 rounded-xl border border-taupe/40 bg-pk-surface text-sm text-ink/80 dark:bg-page">
      <summary className="focus-ring flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl p-4 font-semibold text-ink [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <Question size={18} weight="bold" aria-hidden="true" />
          Need help paying?
        </span>
        <CaretDown
          size={16}
          weight="bold"
          aria-hidden="true"
          className="transition-transform group-open:rotate-180"
        />
      </summary>

      <div className="space-y-3 px-4 pb-4">
        <p>
          <strong className="text-ink">Paying with M-Pesa:</strong> on the next
          page open <Option>Mobile</Option>, select <Option>Kenya</Option> as
          the country, choose <Option>MPESA</Option> as the telco provider, and
          enter your Safaricom number.
        </p>
        <div>
          <p>
            <strong className="text-ink">Paying with card:</strong> on the next
            page open <Option>Card</Option> and enter your card details.
          </p>
          <p className="mt-2">
            Enter the cardholder name{" "}
            <Option>exactly as it appears on your card</Option>, with the same
            capital letters and spelling. Only add punctuation (dots, hyphens,
            apostrophes) if it is printed on the card.
          </p>
        </div>
        <p>
          <strong className="text-ink">Processing fee:</strong> Jenga may add a
          small fee to the amount. The final total is shown on its page before
          you pay.
        </p>
      </div>
    </details>
  );
}
