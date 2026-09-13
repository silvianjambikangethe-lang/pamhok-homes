"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { CheckCircle } from "@phosphor-icons/react";
import { formatMoney } from "@/lib/currency-format";
import type { LaundryPaymentStatus } from "@/lib/supabase/types";

export interface RequestRow {
  id: string;
  request_type: string;
  message: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  roomName: string | null;
  guestName: string | null;
  bookingReference: string | null;
  laundryAmount: number | null;
  laundryCurrency: string | null;
  laundryPaymentStatus: LaundryPaymentStatus | null;
  // Name of the staff_members row that made the CURRENT status what it
  // is — null either because a staff member hasn't touched it yet, or
  // because the current status was actually set by an admin (the
  // laundry-stage/laundry-price routes explicitly clear this for that
  // reason, so it's never stale/misattributed).
  completedByStaffName: string | null;
}

// The server still rejects picking "Awaiting Payment" directly from this
// dropdown (see /api/admin/requests/[id]/laundry-stage) — it can only be
// reached by actually pricing the item via the form below, or a guest
// could end up looking at "payment due" with no amount and no way to
// pay. Kept in this list purely so the <select> has a matching <option>
// to display once a request is already in that state. Same server-side
// story for "Returned": blocked until the charge is actually paid.
const LAUNDRY_STAGES = [
  "Open",
  "Picked Up",
  "Cleaning",
  "Ready",
  "Awaiting Payment",
  "Returned",
  "Closed",
];

export default function RequestsFeed({ requests }: { requests: RequestRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [priceInput, setPriceInput] = useState<Record<string, string>>({});

  async function handleResolve(id: string) {
    setBusyId(id);
    await fetch(`/api/admin/requests/${id}/resolve`, { method: "POST" });
    setBusyId(null);
    router.refresh();
  }

  async function handleLaundryStage(id: string, stage: string) {
    setBusyId(id);
    setRowError((prev) => ({ ...prev, [id]: "" }));
    const res = await fetch(`/api/admin/requests/${id}/laundry-stage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setRowError((prev) => ({ ...prev, [id]: data?.error ?? "Could not update stage." }));
    }
    setBusyId(null);
    router.refresh();
  }

  async function handleSetPrice(id: string) {
    const amount = Number(priceInput[id]);
    if (!Number.isFinite(amount) || amount <= 0) {
      setRowError((prev) => ({ ...prev, [id]: "Enter a valid amount." }));
      return;
    }
    setBusyId(id);
    setRowError((prev) => ({ ...prev, [id]: "" }));
    const res = await fetch(`/api/admin/requests/${id}/laundry-price`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setRowError((prev) => ({ ...prev, [id]: data?.error ?? "Could not set price." }));
    }
    setBusyId(null);
    router.refresh();
  }

  async function handleMarkPaid(id: string) {
    setBusyId(id);
    setRowError((prev) => ({ ...prev, [id]: "" }));
    const res = await fetch(`/api/admin/requests/${id}/laundry-mark-paid`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setRowError((prev) => ({ ...prev, [id]: data?.error ?? "Could not mark as paid." }));
    }
    setBusyId(null);
    router.refresh();
  }

  if (requests.length === 0) {
    return (
      <p className="rounded-2xl border border-taupe/20 bg-surface p-6 text-sm text-ink/65 shadow-card">
        No guest requests yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((r) => {
        const isLaundry = r.request_type === "laundry";
        const isOpenState = isLaundry ? r.status !== "Closed" : r.status !== "Resolved";

        const needsPrice = isLaundry && r.status === "Ready" && !r.laundryPaymentStatus;
        const needsPayment =
          isLaundry && r.status === "Awaiting Payment" && r.laundryPaymentStatus !== "Paid";

        return (
          <div
            key={r.id}
            className={`rounded-2xl border p-5 shadow-card ${
              isOpenState
                ? "border-terracotta-300 bg-terracotta-50/50 dark:border-terracotta-700/40 dark:bg-terracotta-700/10"
                : "border-taupe/20 bg-surface"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-forest-700 px-2.5 py-0.5 text-xs font-semibold capitalize text-white">
                    {r.request_type}
                  </span>
                  <span className="text-xs text-ink/65">
                    {r.guestName ?? "Guest"} · {r.roomName ?? "Room"}
                    {r.bookingReference && ` · ${r.bookingReference}`}
                  </span>
                </div>
                {r.message && <p className="mt-2 whitespace-pre-line text-sm text-ink/80">{r.message}</p>}
                <p className="mt-1 text-xs text-ink/65">
                  {format(parseISO(r.created_at), "d MMM yyyy, h:mm a")}
                </p>
                {(r.status === "Returned" || r.status === "Resolved") && (
                  <p className="mt-1 text-xs font-medium text-ink/65">
                    {r.status} by {r.completedByStaffName ?? "admin"} at{" "}
                    {format(parseISO(r.updated_at), "h:mm a")}
                  </p>
                )}
              </div>

              {isLaundry ? (
                <div className="flex shrink-0 items-center gap-2">
                  <label htmlFor={`stage-${r.id}`} className="sr-only">
                    Laundry stage
                  </label>
                  <select
                    id={`stage-${r.id}`}
                    value={r.status}
                    disabled={busyId === r.id}
                    onChange={(e) => handleLaundryStage(r.id, e.target.value)}
                    className="focus-ring rounded-full border border-taupe/25 bg-page px-3 py-1.5 text-xs font-semibold text-ink/80 disabled:opacity-50"
                  >
                    {LAUNDRY_STAGES.map((stage) => (
                      <option key={stage} value={stage}>
                        {stage}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                r.status !== "Resolved" && (
                  <button
                    onClick={() => handleResolve(r.id)}
                    disabled={busyId === r.id}
                    className="focus-ring flex shrink-0 items-center gap-2 rounded-full border border-forest-500 px-4 py-2 text-xs font-semibold text-forest-700 hover:bg-forest-500 hover:text-white disabled:opacity-50 dark:text-sage-300 dark:hover:text-espresso dark:hover:bg-sage-500"
                  >
                    <CheckCircle size={16} />
                    Resolve
                  </button>
                )
              )}
            </div>

            {isLaundry && r.laundryAmount != null && (
              <p className="mt-3 text-xs text-ink/65">
                Laundry charge: {formatMoney(r.laundryAmount, r.laundryCurrency ?? "KES")} ·{" "}
                {r.laundryPaymentStatus ?? "Pending"}
              </p>
            )}

            {needsPrice && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-taupe/20 pt-3">
                <label htmlFor={`price-${r.id}`} className="text-xs font-medium text-ink/80">
                  Set laundry price
                </label>
                <input
                  id={`price-${r.id}`}
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Amount"
                  value={priceInput[r.id] ?? ""}
                  onChange={(e) => setPriceInput((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  className="focus-ring w-28 rounded-lg border border-taupe/25 bg-page px-2.5 py-1.5 text-sm text-ink"
                />
                <button
                  onClick={() => handleSetPrice(r.id)}
                  disabled={busyId === r.id}
                  className="focus-ring rounded-full bg-mocha-500 dark:bg-terracotta-500 px-4 py-1.5 text-xs font-semibold text-mousse dark:text-white disabled:opacity-50"
                >
                  Send Price
                </button>
              </div>
            )}

            {needsPayment && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-taupe/20 pt-3">
                <p className="text-xs text-ink/65">Waiting on guest payment.</p>
                <button
                  onClick={() => handleMarkPaid(r.id)}
                  disabled={busyId === r.id}
                  className="focus-ring rounded-full border border-forest-500 px-4 py-1.5 text-xs font-semibold text-forest-700 hover:bg-forest-500 hover:text-white disabled:opacity-50 dark:text-sage-300 dark:hover:text-espresso dark:hover:bg-sage-500"
                >
                  Mark Paid (cash/bank)
                </button>
              </div>
            )}

            {rowError[r.id] && (
              <p className="mt-2 text-xs text-danger">{rowError[r.id]}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
