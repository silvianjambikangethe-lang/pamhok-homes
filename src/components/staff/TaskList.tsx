"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { CheckCircle } from "@phosphor-icons/react";
import type { GuestRequestStatus, GuestRequestType, StaffCleaningLaundryFeedRow } from "@/lib/supabase/types";

// Forward-only next-step buttons rather than a <select> — large touch
// targets for a phone browser, one tap advances to the next real stage.
const CLEANING_STEPS: readonly GuestRequestStatus[] = ["Open", "In Progress", "Resolved"];
const LAUNDRY_STEPS: readonly GuestRequestStatus[] = [
  "Open",
  "Picked Up",
  "Cleaning",
  "Ready",
  "Returned",
  "Closed",
];

const CLEANING_LABELS: Record<string, string> = {
  Open: "Pending",
  "In Progress": "In Progress",
  Resolved: "Done",
};

function nextStep(requestType: GuestRequestType, current: GuestRequestStatus) {
  const steps = requestType === "cleaning" ? CLEANING_STEPS : LAUNDRY_STEPS;
  const index = steps.indexOf(current);
  return index >= 0 && index < steps.length - 1 ? steps[index + 1] : null;
}

function displayLabel(requestType: GuestRequestType, status: GuestRequestStatus) {
  return requestType === "cleaning" ? (CLEANING_LABELS[status] ?? status) : status;
}

export default function TaskList({
  requestType,
  requests,
}: {
  requestType: GuestRequestType;
  requests: StaffCleaningLaundryFeedRow[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleAdvance(id: string, status: GuestRequestStatus) {
    setBusyId(id);
    await fetch(`/api/staff/requests/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, requestType }),
    });
    setBusyId(null);
    router.refresh();
  }

  const isDone = (status: GuestRequestStatus) =>
    requestType === "cleaning" ? status === "Resolved" : status === "Closed";

  if (requests.length === 0) {
    return (
      <p className="rounded-2xl border border-taupe/20 bg-surface p-6 text-center text-base text-ink/65 shadow-card">
        Nothing here right now.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((r) => {
        const next = nextStep(requestType, r.status);
        const done = isDone(r.status);
        return (
          <div
            key={r.id}
            className={`rounded-2xl border p-5 shadow-card ${
              done
                ? "border-taupe/20 bg-surface"
                : "border-terracotta-300 bg-terracotta-50/50 dark:border-terracotta-700/40 dark:bg-terracotta-700/10"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-lg font-semibold text-ink">{r.room_name}</span>
              <span className="rounded-full bg-forest-700 px-3 py-1 text-xs font-semibold text-white">
                {displayLabel(requestType, r.status)}
              </span>
            </div>
            {r.message && <p className="mt-2 text-base text-ink/80">{r.message}</p>}
            <p className="mt-1 text-sm text-ink/55">
              {format(parseISO(r.created_at), "d MMM, h:mm a")}
            </p>

            {next && !done && (
              <button
                type="button"
                onClick={() => handleAdvance(r.id, next)}
                disabled={busyId === r.id}
                className="focus-ring mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-mocha-500 dark:bg-terracotta-500 px-5 py-3 text-base font-semibold text-mousse dark:text-white transition-colors hover:bg-mocha-600 dark:hover:bg-terracotta-600 disabled:opacity-50"
              >
                <CheckCircle size={20} />
                {busyId === r.id ? "Updating…" : `Mark ${displayLabel(requestType, next)}`}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
