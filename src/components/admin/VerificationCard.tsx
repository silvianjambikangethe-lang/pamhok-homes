"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Eye, Warning } from "@phosphor-icons/react";
import type { IdVerificationResult } from "@/lib/supabase/types";

export interface VerificationRow {
  id: string;
  check_in: string;
  check_out: string;
  guestName: string | null;
  roomName: string | null;
  hasDocument: boolean;
  hasDocumentBack: boolean;
  hasDocument2: boolean;
  hasDocumentBack2: boolean;
  verificationResult: IdVerificationResult | null;
  verificationResult2: IdVerificationResult | null;
}

type DocType = "front" | "back" | "front2" | "back2";

function resultCopy(result: IdVerificationResult) {
  if (result.resultCode === "provider_error") {
    return { label: "Automated check unavailable", tone: "neutral" as const };
  }
  return { label: result.success ? "Passed" : "Did not pass", tone: result.success ? "pass" as const : "fail" as const };
}

function AttemptResult({ label, result }: { label: string; result: IdVerificationResult }) {
  const { label: statusLabel } = resultCopy(result);
  return (
    <div className="mt-4 flex items-start gap-2 rounded-xl border border-gold-500/30 bg-gold-500/10 p-3.5 text-sm text-ink/80">
      <Warning size={16} className="mt-0.5 shrink-0 text-gold-700" />
      <div>
        <p className="font-semibold text-ink">
          {label}: {statusLabel}
        </p>
        {result.resultText && <p className="mt-0.5">{result.resultText}</p>}
      </div>
    </div>
  );
}

export default function VerificationCard({ row }: { row: VerificationRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [urls, setUrls] = useState<Partial<Record<DocType, string>>>({});
  const [loadingDoc, setLoadingDoc] = useState<DocType | null>(null);

  const hasSecondAttempt = row.hasDocument2 || row.hasDocumentBack2 || !!row.verificationResult2;

  async function handleView(type: DocType) {
    setLoadingDoc(type);
    const res = await fetch(`/api/admin/id-document?bookingId=${row.id}&type=${type}`);
    const data = await res.json();
    setLoadingDoc(null);
    if (res.ok) {
      setUrls((prev) => ({ ...prev, [type]: data.url }));
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

  function viewButton(type: DocType, label: string) {
    return (
      <button
        key={type}
        onClick={() => handleView(type)}
        disabled={loadingDoc === type}
        className="focus-ring flex items-center gap-2 rounded-full border border-taupe/25 px-4 py-2 text-sm font-semibold text-ink/80 hover:border-terracotta-500"
      >
        <Eye size={16} />
        {loadingDoc === type ? "Loading…" : label}
      </button>
    );
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

        <div className="flex flex-wrap justify-end gap-2">
          {row.hasDocument && viewButton("front", `View ID Front${hasSecondAttempt ? " (Attempt 1)" : ""}`)}
          {row.hasDocumentBack && viewButton("back", `View ID Back${hasSecondAttempt ? " (Attempt 1)" : ""}`)}
          {row.hasDocument2 && viewButton("front2", "View ID Front (Attempt 2)")}
          {row.hasDocumentBack2 && viewButton("back2", "View ID Back (Attempt 2)")}
        </div>
      </div>

      {row.verificationResult && (
        <AttemptResult label={hasSecondAttempt ? "Attempt 1" : "Automated check"} result={row.verificationResult} />
      )}
      {row.verificationResult2 && <AttemptResult label="Attempt 2" result={row.verificationResult2} />}
      {!row.verificationResult && !row.verificationResult2 && (
        <p className="mt-4 text-sm text-ink/65">
          No automated result on file — this upload came straight to manual review.
        </p>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {urls.front && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={urls.front}
            alt={`${row.guestName ?? "Guest"}'s ID front (attempt 1)`}
            className="max-h-96 w-full rounded-xl border border-taupe/20 object-contain"
          />
        )}
        {urls.back && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={urls.back}
            alt={`${row.guestName ?? "Guest"}'s ID back (attempt 1)`}
            className="max-h-96 w-full rounded-xl border border-taupe/20 object-contain"
          />
        )}
        {urls.front2 && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={urls.front2}
            alt={`${row.guestName ?? "Guest"}'s ID front (attempt 2)`}
            className="max-h-96 w-full rounded-xl border border-taupe/20 object-contain"
          />
        )}
        {urls.back2 && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={urls.back2}
            alt={`${row.guestName ?? "Guest"}'s ID back (attempt 2)`}
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
