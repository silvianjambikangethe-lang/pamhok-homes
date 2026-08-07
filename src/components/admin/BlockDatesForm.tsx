"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BlockDatesForm({
  rooms,
}: {
  rooms: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? "");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/admin/bookings/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, checkIn, checkOut, note }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Could not block those dates.");
      setSubmitting(false);
      return;
    }

    setCheckIn("");
    setCheckOut("");
    setNote("");
    setSubmitting(false);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-taupe/20 bg-surface p-6 shadow-card"
    >
      <h2 className="font-serif text-lg font-semibold text-ink">
        Block dates (maintenance / personal use)
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="text-sm font-medium text-ink/80">Room</label>
          <select
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            className="focus-ring mt-1.5 w-full rounded-lg border border-taupe/25 bg-page px-3 py-2.5 text-sm text-ink"
          >
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-ink/80">From</label>
          <input
            type="date"
            required
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            className="focus-ring mt-1.5 w-full rounded-lg border border-taupe/25 bg-page px-3 py-2.5 text-sm text-ink"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-ink/80">To</label>
          <input
            type="date"
            required
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            className="focus-ring mt-1.5 w-full rounded-lg border border-taupe/25 bg-page px-3 py-2.5 text-sm text-ink"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-ink/80">Note</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Maintenance"
            className="focus-ring mt-1.5 w-full rounded-lg border border-taupe/25 bg-page px-3 py-2.5 text-sm text-ink"
          />
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <button
        type="submit"
        disabled={submitting || !roomId}
        className="focus-ring mt-4 rounded-full bg-mocha-500 dark:bg-terracotta-500 px-6 py-2.5 text-sm font-semibold text-mousse dark:text-white transition-colors hover:bg-mocha-600 dark:hover:bg-terracotta-600 disabled:opacity-60"
      >
        {submitting ? "Blocking…" : "Block Dates"}
      </button>
    </form>
  );
}
