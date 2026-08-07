"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { CheckCircle } from "@phosphor-icons/react";

export interface RequestRow {
  id: string;
  request_type: string;
  message: string | null;
  status: string;
  created_at: string;
  roomName: string | null;
  guestName: string | null;
  bookingReference: string | null;
}

const LAUNDRY_STAGES = ["Open", "Picked Up", "Cleaning", "Ready", "Returned", "Closed"];

export default function RequestsFeed({ requests }: { requests: RequestRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleResolve(id: string) {
    setBusyId(id);
    await fetch(`/api/admin/requests/${id}/resolve`, { method: "POST" });
    setBusyId(null);
    router.refresh();
  }

  async function handleLaundryStage(id: string, stage: string) {
    setBusyId(id);
    await fetch(`/api/admin/requests/${id}/laundry-stage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
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
        const isOpenState = isLaundry ? r.status !== "Closed" : r.status === "Open";

        return (
          <div
            key={r.id}
            className={`flex flex-wrap items-start justify-between gap-4 rounded-2xl border p-5 shadow-card ${
              isOpenState
                ? "border-terracotta-300 bg-terracotta-50/50 dark:border-terracotta-700/40 dark:bg-terracotta-700/10"
                : "border-taupe/20 bg-surface"
            }`}
          >
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
              r.status === "Open" && (
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
        );
      })}
    </div>
  );
}
