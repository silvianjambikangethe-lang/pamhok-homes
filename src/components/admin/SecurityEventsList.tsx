import { ShieldCheck, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { formatShiftDateTime } from "@/lib/format-time";

export type SecurityEventRow = {
  id: string;
  event_type: string;
  booking_id: string | null;
  request_id: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
  bookingReference: string | null;
};

const EVENT_LABELS: Record<string, string> = {
  mark_booking_paid: "Booking marked paid",
  mark_booking_payment_failed: "Booking payment failed",
  mark_laundry_paid: "Laundry marked paid",
  mark_laundry_payment_failed: "Laundry payment failed",
  double_booking_conflict: "Double booking — two guests paid for the same dates, refund one",
};

export default function SecurityEventsList({ events }: { events: SecurityEventRow[] }) {
  if (events.length === 0) {
    return (
      <p className="mt-3 rounded-2xl border border-taupe/20 bg-surface p-5 text-sm text-ink/65 shadow-card">
        No privileged guest-side actions logged yet.
      </p>
    );
  }

  return (
    <div className="mt-3 overflow-x-auto rounded-2xl border border-taupe/20 bg-surface shadow-card">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-taupe/20 text-xs uppercase tracking-wide text-ink/55">
            <th className="px-4 py-3 font-medium">Event</th>
            <th className="px-4 py-3 font-medium">Booking</th>
            <th className="px-4 py-3 font-medium">Detail</th>
            <th className="px-4 py-3 font-medium">When</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => {
            // A second successful payment for an already-paid booking: the
            // guest was charged twice and may be owed a refund.
            const paidTwice = e.event_type === "mark_booking_paid" && e.detail?.already_paid === true;
            return (
              <tr
                key={e.id}
                className={`border-b border-taupe/10 last:border-0 ${paidTwice ? "bg-pk-warning-bg dark:bg-gold-500/15" : ""}`}
              >
                <td className="px-4 py-3 font-medium text-ink">
                  <span className="flex items-center gap-1.5">
                    {paidTwice ? (
                      <WarningCircle size={14} weight="bold" className="shrink-0 text-pk-warning dark:text-gold-500" />
                    ) : (
                      <ShieldCheck size={14} className="shrink-0 text-forest-600 dark:text-sage-300" />
                    )}
                    {paidTwice
                      ? "Paid twice — check whether a refund is owed"
                      : (EVENT_LABELS[e.event_type] ?? e.event_type)}
                  </span>
                </td>
                <td className="px-4 py-3 text-ink/80">{e.bookingReference ?? "—"}</td>
                <td className="px-4 py-3 text-ink/65">
                  {e.detail
                    ? Object.entries(e.detail)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(", ")
                    : "—"}
                </td>
                <td className="px-4 py-3 text-ink/65">{formatShiftDateTime(e.created_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
