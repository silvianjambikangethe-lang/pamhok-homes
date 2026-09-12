"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash } from "@phosphor-icons/react";
import type { BlockedGuestName } from "@/lib/supabase/types";

// Unlike StaffMembersForm, entries here are hard-deleted rather than
// toggled inactive — there's no history/foreign key tying other rows to a
// blocklist entry, so there's nothing a delete would orphan.
export default function BlockedGuestNamesForm({ initial }: { initial: BlockedGuestName[] }) {
  const router = useRouter();
  const [entries, setEntries] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newReason, setNewReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setError(null);
    setBusyId("new");

    const res = await fetch("/api/admin/blocked-names", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: newName.trim(), reason: newReason.trim() || undefined }),
    });
    setBusyId(null);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not add to the blocklist.");
      return;
    }

    setNewName("");
    setNewReason("");
    router.refresh();
  }

  async function handleRemove(id: string) {
    setBusyId(id);
    setError(null);

    const res = await fetch(`/api/admin/blocked-names/${id}`, { method: "DELETE" });
    setBusyId(null);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not remove from the blocklist.");
      return;
    }

    setEntries(entries.filter((entry) => entry.id !== id));
  }

  return (
    <div className="rounded-2xl border border-taupe/20 bg-surface p-6 shadow-card sm:p-8">
      <h2 className="font-serif text-lg font-semibold text-ink">Blocked Guests</h2>
      <p className="mt-1 text-xs text-ink/65">
        A name added here can&apos;t complete a booking — checked against both the online booking
        form and walk-in bookings you create yourself.
      </p>

      <div className="mt-4 space-y-3">
        {entries.length === 0 && (
          <p className="text-sm text-ink/65">No one is currently blocked.</p>
        )}
        {entries.map((entry) => {
          const busy = busyId === entry.id;
          return (
            <div
              key={entry.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-taupe/20 bg-page p-3"
            >
              <div className="flex-1">
                <span className="text-sm font-medium text-ink">{entry.full_name}</span>
                {entry.reason && <p className="text-xs text-ink/60">{entry.reason}</p>}
              </div>
              <button
                type="button"
                onClick={() => handleRemove(entry.id)}
                disabled={busy}
                aria-label={`Remove ${entry.full_name} from the blocklist`}
                className="focus-ring flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-danger transition-colors hover:bg-danger/10 disabled:opacity-60"
              >
                <Trash size={14} /> Remove
              </button>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleAdd} className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          required
          maxLength={200}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Full name to block"
          className="focus-ring min-w-[12rem] flex-1 rounded-lg border border-taupe/25 bg-page px-3 py-2 text-sm text-ink"
        />
        <input
          type="text"
          maxLength={500}
          value={newReason}
          onChange={(e) => setNewReason(e.target.value)}
          placeholder="Reason (optional)"
          className="focus-ring min-w-[12rem] flex-1 rounded-lg border border-taupe/25 bg-page px-3 py-2 text-sm text-ink"
        />
        <button
          type="submit"
          disabled={busyId === "new"}
          className="focus-ring flex items-center gap-1.5 rounded-full border border-taupe/25 px-4 py-2 text-xs font-semibold text-ink/80 hover:border-terracotta-300 disabled:opacity-60"
        >
          <Plus size={14} /> Block Name
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </div>
  );
}
