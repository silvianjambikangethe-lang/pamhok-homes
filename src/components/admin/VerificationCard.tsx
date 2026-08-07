"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Eye, Warning } from "@phosphor-icons/react";
import type { SmileIdResult } from "@/lib/supabase/types";

export interface VerificationRow {
  id: string;
  check_in: string;
  check_out: string;
  guestName: string | null;
  roomName: string | null;
  hasDocument: boolean;
  hasSelfie: boolean;
  smileIdResult: SmileIdResult | null;
  attempts: number;
}

export default function VerificationCard({ row }: { row: VerificationRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [loadingDoc, setLoadingDoc] = useState<"id" | "selfie" | null>(null);

  async function handleView(type: "id" | "selfie") {
    setLoadingDoc(type);
    const res = await fetch(`/api/admin/id-document?bookingId=${row.id}&type=${type}`);
    const data = await res.json();
    setLoadingDoc(null);
    if (res.ok) {
      if (type === "id") setDocUrl(data.url);
      else setSelfieUrl(data.url);
    }
  }

  async function handleDecision(status: "Verified" | "Rejected") {
    setBusy(true);
    await fetch(`/api/admin/bookings/${row.id}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-taupe/20 bg-surface p-6 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-ink">{row.guestName ?? "Guest"}</p>
          <p className="text-sm text-ink/65">
            {row.roomName ?? "Room"} · {format(parseISO(row.check_in), "d MMM")} →{" "}
            {format(parseISO(row.check_out), "d MMM yyyy")}
          </p>
        </div>

        <div className="flex gap-2">
          {row.hasDocument && (
            <button
              onClick={() => handleView("id")}
              disabled={loadingDoc === "id"}
              className="focus-ring flex items-center gap-2 rounded-full border border-taupe/25 px-4 py-2 text-sm font-semibold text-ink/80 hover:border-terracotta-500"
            >
              <Eye size={16} />
              {loadingDoc === "id" ? "Loading…" : "View ID"}
            </button>
          )}
          {row.hasSelfie && (
            <button
              onClick={() => handleView("selfie")}
              disabled={loadingDoc === "selfie"}
              className="focus-ring flex items-center gap-2 rounded-full border border-taupe/25 px-4 py-2 text-sm font-semibold text-ink/80 hover:border-terracotta-500"
            >
              <Eye size={16} />
              {loadingDoc === "selfie" ? "Loading…" : "View Selfie"}
            </button>
          )}
        </div>
      </div>

      {row.smileIdResult && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-gold-500/30 bg-gold-500/10 p-3.5 text-sm text-ink/80">
          <Warning size={16} className="mt-0.5 shrink-0 text-gold-700" />
          <div>
            <p className="font-semibold text-ink">
              Automated check: {row.smileIdResult.success ? "Passed" : "Did not pass"}
              {row.attempts > 0 &&
                ` (after ${row.attempts} attempt${row.attempts === 1 ? "" : "s"})`}
            </p>
            {row.smileIdResult.resultText && <p className="mt-0.5">{row.smileIdResult.resultText}</p>}
          </div>
        </div>
      )}
      {!row.smileIdResult && (
        <p className="mt-4 text-sm text-ink/65">
          No automated check ran for this upload (e.g. a PDF, or Smile ID wasn&apos;t reachable) —
          it came straight to manual review.
        </p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {docUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={docUrl}
            alt={`${row.guestName ?? "Guest"}'s ID document`}
            className="max-h-96 w-full rounded-xl border border-taupe/20 object-contain"
          />
        )}
        {selfieUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={selfieUrl}
            alt={`${row.guestName ?? "Guest"}'s selfie`}
            className="max-h-96 w-full rounded-xl border border-taupe/20 object-contain"
          />
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => handleDecision("Verified")}
          disabled={busy}
          className="focus-ring rounded-full bg-success px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          Approve
        </button>
        <button
          onClick={() => handleDecision("Rejected")}
          disabled={busy}
          className="focus-ring rounded-full border border-danger px-5 py-2 text-sm font-semibold text-danger hover:bg-danger hover:text-white disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
