"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserCircle } from "@phosphor-icons/react";
import type { StaffMember } from "@/lib/supabase/types";

export default function TapWorkerScreen({ workers }: { workers: StaffMember[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleTap(id: string) {
    setBusyId(id);
    setError(null);

    const res = await fetch("/api/staff/select-worker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workerId: id }),
    });

    if (!res.ok) {
      setBusyId(null);
      setError("Could not select that name. Try again.");
      return;
    }

    router.push("/staff/overview");
    router.refresh();
  }

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-10">
      <h1 className="text-center font-serif text-2xl font-semibold text-ink">
        Who&apos;s working?
      </h1>
      <p className="mt-1.5 text-center text-sm text-ink/65">Tap your name to continue.</p>

      {workers.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-taupe/20 bg-surface p-6 text-center text-sm text-ink/65 shadow-card">
          No worker names have been set up yet. Ask the host to add names from Settings.
        </p>
      ) : (
        <div className="mt-8 grid w-full max-w-lg grid-cols-2 gap-4 sm:grid-cols-3">
          {workers.map((worker) => (
            <button
              key={worker.id}
              type="button"
              onClick={() => handleTap(worker.id)}
              disabled={busyId !== null}
              className="focus-ring flex flex-col items-center gap-2 rounded-2xl border border-taupe/20 bg-surface p-6 shadow-card transition-transform hover:-translate-y-0.5 disabled:opacity-50"
            >
              <UserCircle size={40} weight="light" className="text-terracotta-600" />
              <span className="text-base font-semibold text-ink">{worker.name}</span>
              {busyId === worker.id && <span className="text-xs text-ink/55">Signing in…</span>}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
