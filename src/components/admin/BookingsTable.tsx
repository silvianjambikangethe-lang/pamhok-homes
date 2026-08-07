"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";

export interface AdminBookingRow {
  id: string;
  booking_reference: string | null;
  check_in: string;
  check_out: string;
  total_amount: number;
  currency: string;
  payment_status: string;
  booking_status: string;
  refund_status: string | null;
  guestName: string | null;
  roomName: string | null;
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

const PAYMENT_BADGE: Record<string, string> = {
  Pending: "bg-[#A7866A] text-cocoa dark:bg-gold-500 dark:text-espresso",
  Paid: "bg-forest-500 text-mousse dark:bg-sage-500 dark:text-espresso",
  Failed: "bg-danger text-mousse dark:text-white",
  Refunded: "bg-ink/10 text-ink/80",
};

const BOOKING_BADGE: Record<string, string> = {
  Confirmed: "bg-forest-500 text-mousse dark:bg-sage-500 dark:text-espresso",
  Cancelled: "bg-danger text-mousse dark:text-white",
  Blocked: "bg-ink/10 text-ink/80",
  "Pending Verification": "bg-[#A7866A] text-cocoa dark:bg-gold-500 dark:text-espresso",
};

export default function BookingsTable({ bookings }: { bookings: AdminBookingRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleAction(id: string, action: "mark-paid" | "cancel" | "mark-refunded") {
    setBusyId(id);
    await fetch(`/api/admin/bookings/${id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setBusyId(null);
    router.refresh();
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-taupe/20 bg-surface shadow-card">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-taupe/20 text-xs uppercase tracking-wide text-ink/65">
            <th className="px-5 py-3 font-semibold">Reference</th>
            <th className="px-5 py-3 font-semibold">Guest</th>
            <th className="px-5 py-3 font-semibold">Room</th>
            <th className="px-5 py-3 font-semibold">Dates</th>
            <th className="px-5 py-3 font-semibold">Amount</th>
            <th className="px-5 py-3 font-semibold">Payment</th>
            <th className="px-5 py-3 font-semibold">Status</th>
            <th className="px-5 py-3 font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {bookings.length === 0 && (
            <tr>
              <td colSpan={8} className="px-5 py-8 text-center text-ink/65">
                No bookings yet.
              </td>
            </tr>
          )}
          {bookings.map((b) => (
            <tr key={b.id} className="border-b border-taupe/10 last:border-0">
              <td className="px-5 py-4 font-mono text-xs text-ink/65">
                {b.booking_reference ?? "—"}
              </td>
              <td className="px-5 py-4 text-ink/80">
                {b.guestName ?? <span className="text-ink/65">Blocked dates</span>}
              </td>
              <td className="px-5 py-4 text-ink/80">{b.roomName ?? "—"}</td>
              <td className="px-5 py-4 whitespace-nowrap text-ink/80">
                {format(parseISO(b.check_in), "d MMM")} → {format(parseISO(b.check_out), "d MMM yyyy")}
              </td>
              <td className="px-5 py-4 text-ink/80">
                {formatCurrency(b.total_amount, b.currency)}
              </td>
              <td className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${PAYMENT_BADGE[b.payment_status]}`}>
                    {b.payment_status}
                  </span>
                  {b.refund_status && (
                    <span className="rounded-full bg-danger/15 px-2.5 py-1 text-xs font-semibold text-danger">
                      {b.refund_status}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-5 py-4">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${BOOKING_BADGE[b.booking_status]}`}>
                  {b.booking_status}
                </span>
              </td>
              <td className="px-5 py-4">
                <div className="flex gap-2">
                  {b.booking_status === "Confirmed" && (
                    <>
                      {b.payment_status !== "Paid" && (
                        <button
                          onClick={() => handleAction(b.id, "mark-paid")}
                          disabled={busyId === b.id}
                          className="focus-ring rounded-full border border-forest-500 px-3 py-1 text-xs font-semibold text-forest-700 hover:bg-forest-500 hover:text-white disabled:opacity-50 dark:text-sage-300 dark:hover:text-espresso dark:hover:bg-sage-500"
                        >
                          Mark Paid
                        </button>
                      )}
                      <button
                        onClick={() => handleAction(b.id, "cancel")}
                        disabled={busyId === b.id}
                        className="focus-ring rounded-full border border-danger px-3 py-1 text-xs font-semibold text-danger hover:bg-danger hover:text-white disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                  {b.refund_status && (
                    <button
                      onClick={() => handleAction(b.id, "mark-refunded")}
                      disabled={busyId === b.id}
                      className="focus-ring rounded-full border border-forest-500 px-3 py-1 text-xs font-semibold text-forest-700 hover:bg-forest-500 hover:text-white disabled:opacity-50 dark:text-sage-300 dark:hover:text-espresso dark:hover:bg-sage-500"
                    >
                      Mark Refunded
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
