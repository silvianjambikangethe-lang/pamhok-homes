"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { CheckCircle } from "@phosphor-icons/react";
import type { GuestRequestStatus, StaffCheckoutScheduleRow } from "@/lib/supabase/types";

const STEPS: readonly GuestRequestStatus[] = ["Open", "In Progress", "Resolved"];
const LABELS: Record<string, string> = { Open: "Pending", "In Progress": "In Progress", Resolved: "Done" };

function nextStep(current: GuestRequestStatus | null) {
  const status = current ?? "Open";
  const index = STEPS.indexOf(status);
  return index >= 0 && index < STEPS.length - 1 ? STEPS[index + 1] : null;
}

export default function CleaningScheduleList({ items }: { items: StaffCheckoutScheduleRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleAdvance(bookingId: string, status: GuestRequestStatus) {
    setBusyId(bookingId);
    await fetch(`/api/staff/schedule/${bookingId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusyId(null);
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-taupe/20 bg-surface p-6 text-center text-base text-ink/65 shadow-card">
        No checkouts scheduled for today or tomorrow.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const status = item.cleaning_status ?? "Open";
        const done = status === "Resolved";
        const next = nextStep(item.cleaning_status);
        return (
          <div
            key={item.booking_id}
            className={`rounded-2xl border p-5 shadow-card ${
              done
                ? "border-taupe/20 bg-surface"
                : "border-terracotta-300 bg-terracotta-50/50 dark:border-terracotta-700/40 dark:bg-terracotta-700/10"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-lg font-semibold text-ink">{item.room_name}</span>
              <span className="rounded-full bg-forest-700 px-3 py-1 text-xs font-semibold text-white">
                {LABELS[status] ?? status}
              </span>
            </div>
            <p className="mt-1 text-sm text-ink/65">
              Checkout {format(parseISO(item.check_out), "EEE, d MMM")}
            </p>

            {next && !done && (
              <button
                type="button"
                onClick={() => handleAdvance(item.booking_id, next)}
                disabled={busyId === item.booking_id}
                className="focus-ring mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-mocha-500 dark:bg-terracotta-500 px-5 py-3 text-base font-semibold text-mousse dark:text-white transition-colors hover:bg-mocha-600 dark:hover:bg-terracotta-600 disabled:opacity-50"
              >
                <CheckCircle size={20} />
                {busyId === item.booking_id ? "Updating…" : `Mark ${LABELS[next] ?? next}`}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
