"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { subDays, parseISO, format } from "date-fns";
import { CaretDown } from "@phosphor-icons/react";

// Builds a tz-aware instant from a date input's "YYYY-MM-DD" and a time
// input's "HH:mm", interpreted in the admin's own local clock (the browser's
// timezone) — done here rather than on the server so there's no ambiguity
// about whose timezone a bare date+time string would mean.
function combineDateTime(dateStr: string, timeStr: string): string {
  return new Date(`${dateStr}T${timeStr}:00`).toISOString();
}

export default function BlockDatesForm({
  rooms,
}: {
  rooms: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? "");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  // Optional — leaving both blank blocks the whole day(s) as before, with
  // no defined end time to ever flag as "time's up" in the Room Status
  // grid. Filling either in lets the block carry a precise start/end (e.g.
  // "today 2pm-5pm", or "today 10am through tomorrow").
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    // check_in/check_out (whole-day, exclusive-end) stay the only thing
    // availability math reads — unchanged by any of this. block_start_at/
    // block_end_at are purely a precise display/reminder layer on top:
    // the end time belongs to the LAST day actually blocked, which is the
    // day before the exclusive checkOut date, not checkOut itself.
    const blockStartAt = startTime ? combineDateTime(checkIn, startTime) : null;
    const blockEndAt = endTime
      ? combineDateTime(format(subDays(parseISO(checkOut), 1), "yyyy-MM-dd"), endTime)
      : null;

    const res = await fetch("/api/admin/bookings/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, checkIn, checkOut, note, blockStartAt, blockEndAt }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Could not block those dates.");
      setSubmitting(false);
      return;
    }

    setCheckIn("");
    setCheckOut("");
    setStartTime("");
    setEndTime("");
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
          <div className="relative mt-1.5">
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="focus-ring w-full appearance-none rounded-lg border border-taupe/25 bg-page px-3 py-2.5 pr-9 text-sm text-ink"
            >
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <CaretDown
              size={14}
              weight="bold"
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink/50"
            />
          </div>
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
        <div>
          <label className="text-sm font-medium text-ink/80">
            Start time <span className="font-normal text-ink/50">(optional)</span>
          </label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="focus-ring mt-1.5 w-full rounded-lg border border-taupe/25 bg-page px-3 py-2.5 text-sm text-ink"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-ink/80">
            End time <span className="font-normal text-ink/50">(optional)</span>
          </label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="focus-ring mt-1.5 w-full rounded-lg border border-taupe/25 bg-page px-3 py-2.5 text-sm text-ink"
          />
        </div>
      </div>
      <p className="mt-2 text-xs text-ink/50">
        Leave the times blank to block the full day(s). Fill them in for a
        same-day block (e.g. 2pm-5pm) or a precise window spanning days (e.g.
        today 10am through tomorrow) — once the end time passes, this room
        flags in Room Status for you to confirm it&apos;s free again.
      </p>
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
