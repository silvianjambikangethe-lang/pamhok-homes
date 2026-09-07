"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "@phosphor-icons/react";
import { format, parseISO } from "date-fns";

export default function ClockToggle({
  clockedIn,
  clockInAt,
}: {
  clockedIn: boolean;
  clockInAt: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/staff/clock/${clockedIn ? "out" : "in"}`, { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Something went wrong.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-taupe/20 bg-surface p-8 text-center shadow-card">
      <Clock size={48} weight="light" className="mx-auto text-terracotta-600" />
      <p className="mt-3 text-lg font-semibold text-ink">
        {clockedIn ? "You're clocked in" : "You're clocked out"}
      </p>
      {clockedIn && clockInAt && (
        <p className="mt-1 text-sm text-ink/65">
          Since {format(parseISO(clockInAt), "h:mm a")}
        </p>
      )}

      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className={`focus-ring mt-6 w-full rounded-full px-6 py-4 text-lg font-semibold transition-colors disabled:opacity-50 ${
          clockedIn
            ? "bg-danger text-white hover:opacity-90"
            : "bg-mocha-500 dark:bg-terracotta-500 text-mousse dark:text-white hover:bg-mocha-600 dark:hover:bg-terracotta-600"
        }`}
      >
        {busy ? "Working…" : clockedIn ? "Clock Out" : "Clock In"}
      </button>

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
