"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserCircle } from "@phosphor-icons/react";
import type { StaffMember } from "@/lib/supabase/types";

export default function TapWorkerScreen({ workers }: { workers: StaffMember[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<StaffMember | null>(null);
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleTap(worker: StaffMember) {
    setSelected(worker);
    setPin("");
    setError(null);
  }

  function handleBack() {
    setSelected(null);
    setPin("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || submitting) return;

    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/staff/select-worker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workerId: selected.id, pin }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setSubmitting(false);
      setPin("");
      setError(data?.error ?? "Could not select that name. Try again.");
      return;
    }

    router.push("/staff/overview");
    router.refresh();
  }

  if (selected) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-10">
        <button
          type="button"
          onClick={handleBack}
          className="focus-ring mb-6 flex items-center gap-1.5 self-start text-sm font-medium text-ink/65 hover:text-ink"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <UserCircle size={48} weight="light" className="text-terracotta-600" />
        <h1 className="mt-3 text-center font-serif text-2xl font-semibold text-ink">
          {selected.name}
        </h1>
        <p className="mt-1.5 text-center text-sm text-ink/65">Enter your PIN to continue.</p>

        <form onSubmit={handleSubmit} className="mt-6 flex w-full max-w-xs flex-col items-center gap-3">
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            placeholder="PIN"
            className="focus-ring w-full rounded-lg border border-taupe/25 bg-page px-4 py-3 text-center text-lg tracking-[0.5em] text-ink"
          />
          <button
            type="submit"
            disabled={submitting || pin.length < 4}
            className="focus-ring w-full rounded-full bg-mocha-500 dark:bg-terracotta-500 px-5 py-3 text-sm font-semibold text-mousse dark:text-white transition-colors hover:bg-mocha-600 dark:hover:bg-terracotta-600 disabled:opacity-60"
          >
            {submitting ? "Checking…" : "Continue"}
          </button>
        </form>

        {error && (
          <p role="alert" className="mt-4 max-w-xs text-center text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    );
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
              onClick={() => handleTap(worker)}
              className="focus-ring flex flex-col items-center gap-2 rounded-2xl border border-taupe/20 bg-surface p-6 shadow-card transition-transform hover:-translate-y-0.5"
            >
              <UserCircle size={40} weight="light" className="text-terracotta-600" />
              <span className="text-base font-semibold text-ink">{worker.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
