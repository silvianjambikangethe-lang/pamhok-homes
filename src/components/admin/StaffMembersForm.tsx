"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash, ArrowCounterClockwise, Key } from "@phosphor-icons/react";
import type { StaffMember } from "@/lib/supabase/types";

// "Remove" deactivates (reversible via Reactivate) — shift_logs.
// staff_member_id is `on delete restrict` so a worker with shift history
// can't be hard-deleted anyway, and deactivating already removes them
// from the /staff tap screen immediately.
//
// "Delete Permanently" is the real, non-reversible action: it clears the
// worker's pin_hash and attempts to remove the row entirely (falling
// back to deactivate-and-clear-PIN if shift history blocks the hard
// delete — see the API route). Either way their specific PIN is
// permanently dead, with no effect on any other worker's PIN.
//
// Neither action touches the shared staff@... login itself — every
// worker signs into that same one account (see StaffCredentialsForm) to
// even reach this tap screen; the PIN is what actually distinguishes one
// worker from another underneath it. Change the password under Staff
// Login below if you need to cut off someone who knows the shared
// credential itself, not just their own PIN.
export default function StaffMembersForm({ initial }: { initial: StaffMember[] }) {
  const router = useRouter();
  const [members, setMembers] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [resetPinId, setResetPinId] = useState<string | null>(null);
  const [resetPinValue, setResetPinValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function patchMember(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    setError(null);
    setNotice(null);
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
    if (!newName.trim() || !newPin) return;
    setError(null);
    setNotice(null);
    setBusyId("new");

    const res = await fetch("/api/admin/staff-members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), pin: newPin }),
    });
    setBusyId(null);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not add worker.");
      return;
    }

    setNewName("");
    setNewPin("");
    router.refresh();
  }

  async function handleResetPin(id: string) {
    if (!resetPinValue) return;
    const ok = await patchMember(id, { pin: resetPinValue });
    if (ok) {
      setResetPinId(null);
      setResetPinValue("");
      setNotice("PIN updated.");
    }
  }

  async function handleDeletePermanently(id: string) {
    setBusyId(id);
    setError(null);
    setNotice(null);
    const res = await fetch(`/api/admin/staff-members/${id}`, { method: "DELETE" });
    setBusyId(null);
    setConfirmDeleteId(null);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not delete worker.");
      return;
    }

    const data = await res.json().catch(() => null);
    if (data?.hardDeleted) {
      setMembers(members.filter((m) => m.id !== id));
      setNotice("Worker deleted permanently.");
    } else {
      setMembers(members.map((m) => (m.id === id ? { ...m, active: false, pin_hash: null } : m)));
      setNotice("This worker has shift history, so their record was kept, but deactivated and their PIN permanently cleared — the same practical result.");
    }
  }

  return (
    <div className="rounded-2xl border border-taupe/20 bg-surface p-6 shadow-card sm:p-8">
      <h2 className="font-serif text-lg font-semibold text-ink">Staff Members</h2>
      <p className="mt-1 text-xs text-ink/65">
        Names shown on the tap-in screen at /staff. Each worker taps their name and enters their own
        PIN — Remove takes them off the list (reversible), Delete Permanently kills their PIN for
        good. Note: everyone still signs into the same shared staff login first; change its password
        under Staff Login below if you need to cut off someone who knows that.
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
              className="rounded-xl border border-taupe/20 bg-page p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={`flex-1 text-sm font-medium ${member.active ? "text-ink" : "text-ink/50"}`}>
                  {member.name}
                  {!member.active && <span className="ml-2 text-xs text-ink/45">(Removed)</span>}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setResetPinId(resetPinId === member.id ? null : member.id);
                    setResetPinValue("");
                  }}
                  disabled={busy}
                  className="focus-ring flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-ink/70 hover:bg-ink/10 disabled:opacity-60"
                >
                  <Key size={14} /> Reset PIN
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleActive(member)}
                  disabled={busy}
                  className={`focus-ring flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-60 ${
                    member.active ? "text-danger hover:bg-danger/10" : "text-ink/70 hover:bg-ink/10"
                  }`}
                >
                  {member.active ? (
                    <>
                      <Trash size={14} /> Remove
                    </>
                  ) : (
                    <>
                      <ArrowCounterClockwise size={14} /> Reactivate
                    </>
                  )}
                </button>
                {confirmDeleteId === member.id ? (
                  <span className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleDeletePermanently(member.id)}
                      disabled={busy}
                      className="focus-ring rounded-full bg-danger px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
                    >
                      Confirm delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="focus-ring rounded-full px-3 py-1.5 text-xs font-semibold text-ink/60 hover:bg-ink/10"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(member.id)}
                    disabled={busy}
                    className="focus-ring rounded-full px-3 py-1.5 text-xs font-semibold text-danger/80 hover:bg-danger/10 disabled:opacity-60"
                  >
                    Delete Permanently
                  </button>
                )}
              </div>

              {resetPinId === member.id && (
                <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-taupe/15 pt-2.5">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={resetPinValue}
                    onChange={(e) => setResetPinValue(e.target.value.replace(/\D/g, ""))}
                    placeholder="New 4-6 digit PIN"
                    className="focus-ring min-w-0 flex-1 rounded-lg border border-taupe/25 bg-surface px-3 py-1.5 text-sm text-ink"
                  />
                  <button
                    type="button"
                    onClick={() => handleResetPin(member.id)}
                    disabled={busy || resetPinValue.length < 4}
                    className="focus-ring rounded-full bg-mocha-500 dark:bg-terracotta-500 px-3.5 py-1.5 text-xs font-semibold text-mousse dark:text-white disabled:opacity-60"
                  >
                    Save PIN
                  </button>
                </div>
              )}
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
          className="focus-ring min-w-[10rem] flex-1 rounded-lg border border-taupe/25 bg-page px-3 py-2 text-sm text-ink"
        />
        <input
          type="password"
          required
          inputMode="numeric"
          maxLength={6}
          value={newPin}
          onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
          placeholder="4-6 digit PIN"
          className="focus-ring w-32 rounded-lg border border-taupe/25 bg-page px-3 py-2 text-sm text-ink"
        />
        <button
          type="submit"
          disabled={busyId === "new" || newPin.length < 4}
          className="focus-ring flex items-center gap-1.5 rounded-full border border-taupe/25 px-4 py-2 text-xs font-semibold text-ink/80 hover:border-terracotta-300 disabled:opacity-60"
        >
          <Plus size={14} /> Add Worker
        </button>
      </form>

      {notice && <p className="mt-3 text-sm text-success">{notice}</p>}
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
    </div>
  );
}
