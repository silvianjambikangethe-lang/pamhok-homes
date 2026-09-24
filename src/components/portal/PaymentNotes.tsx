function Option({ children }: { children: React.ReactNode }) {
  return (
    <strong className="rounded bg-terracotta-100 px-1.5 py-0.5 font-bold text-terracotta-700 underline decoration-terracotta-500 decoration-2 underline-offset-4 dark:bg-terracotta-700/40 dark:text-terracotta-300">
      {children}
    </strong>
  );
}

export default function PaymentNotes() {
  return (
    <div className="mt-4 space-y-3 rounded-xl border border-taupe/40 bg-pk-surface p-4 text-sm text-ink/80 dark:bg-page">
      <p>
        <strong className="text-ink">Paying with M-Pesa:</strong> on the next
        page open <Option>Mobile</Option>, choose <Option>MPESA</Option>, and
        enter your Safaricom number.
      </p>
      <p>
        <strong className="text-ink">Paying with card:</strong> on the next
        page open <Option>Card</Option> and enter your card details.
      </p>
    </div>
  );
}
