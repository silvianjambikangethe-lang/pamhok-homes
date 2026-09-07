"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "@phosphor-icons/react";
import type { StaffMember } from "@/lib/supabase/types";

// No delete button on purpose — "removing" a worker means deactivating,
// not deleting. shift_logs.staff_member_id is `on delete restrict` (a
// worker with shift history can't be hard-deleted), and deactivating
// already removes them from the /staff tap screen immediately.
export default function StaffMembersForm({ initial }: { initial: StaffMember[] }) {
  const router = useRouter();
  const [members, setMembers] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function patchMember(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/admin/staff-members/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not update worker.");
      return false;
    }
    return true;
  }

  async function handleToggleActive(member: StaffMember) {
    const ok = await patchMember(member.id, { active: !member.active });
    if (ok) {
      setMembers(members.map((m) => (m.id === member.id ? { ...m, active: !m.active } : m)));
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setError(null);
    setBusyId("new");

    const res = await fetch("/api/admin/staff-members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    setBusyId(null);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not add worker.");
      return;
    }

    setNewName("");
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-taupe/20 bg-surface p-6 shadow-card sm:p-8">
      <h2 className="font-serif text-lg font-semibold text-ink">Staff Members</h2>
      <p className="mt-1 text-xs text-ink/65">
        Names shown on the tap-in screen at /staff. Deactivating removes someone from that list
        immediately — no password reset needed.
      </p>

      <div className="mt-4 space-y-3">
        {members.length === 0 && (
          <p className="text-sm text-ink/65">No workers added yet.</p>
        )}
        {members.map((member) => {
          const busy = busyId === member.id;
          return (
            <div
              key={member.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-taupe/20 bg-page p-3"
            >
              <span className="flex-1 text-sm font-medium text-ink">{member.name}</span>
              <button
                type="button"
                onClick={() => handleToggleActive(member)}
                disabled={busy}
                className={`focus-ring rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-60 ${
                  member.active
                    ? "bg-forest-500 text-ivory-dark dark:bg-sage-500 dark:text-espresso"
                    : "bg-ink/10 text-ink/70"
                }`}
              >
                {member.active ? "Active" : "Inactive"}
              </button>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleAdd} className="mt-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          required
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Worker's name"
          className="focus-ring min-w-[12rem] flex-1 rounded-lg border border-taupe/25 bg-page px-3 py-2 text-sm text-ink"
        />
        <button
          type="submit"
          disabled={busyId === "new"}
          className="focus-ring flex items-center gap-1.5 rounded-full border border-taupe/25 px-4 py-2 text-xs font-semibold text-ink/80 hover:border-terracotta-300 disabled:opacity-60"
        >
          <Plus size={14} /> Add Worker
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </div>
  );
}
