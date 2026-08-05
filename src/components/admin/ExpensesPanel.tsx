"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, format, isBefore, parseISO, startOfDay } from "date-fns";
import { Plus, Trash, Warning } from "@phosphor-icons/react";
import type { BillingCycle, BusinessExpense } from "@/lib/supabase/types";

const CYCLES: { value: BillingCycle; label: string }[] = [
  { value: "monthly", label: "Monthly" },
  { value: "annual", label: "Annual" },
  { value: "one-time", label: "One-time" },
];

function formatAmount(amount: number | null, currency: string) {
  if (amount === null) return "—";
  try {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

function isDueSoon(nextDueDate: string) {
  const due = startOfDay(parseISO(nextDueDate));
  const threshold = addDays(startOfDay(new Date()), 3);
  return !isBefore(threshold, due); // due <= today + 3 days (includes overdue)
}

export default function ExpensesPanel({ initial }: { initial: BusinessExpense[] }) {
  const router = useRouter();
  const [expenses, setExpenses] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newCurrency, setNewCurrency] = useState("KES");
  const [newCycle, setNewCycle] = useState<BillingCycle>("monthly");
  const [newDueDate, setNewDueDate] = useState("");
  const [newNotes, setNewNotes] = useState("");

  async function patchExpense(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/admin/business-expenses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusyId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not update expense.");
      return false;
    }
    return true;
  }

  function updateLocal(id: string, patch: Partial<BusinessExpense>) {
    setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  async function handleDelete(id: string) {
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/admin/business-expenses/${id}`, { method: "DELETE" });
    setBusyId(null);
    if (res.ok) {
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not delete expense.");
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newDueDate) return;
    setError(null);
    setBusyId("new");

    const res = await fetch("/api/admin/business-expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName.trim(),
        amount: newAmount.trim() ? Number(newAmount) : null,
        currency: newCurrency.trim() || "KES",
        billingCycle: newCycle,
        nextDueDate: newDueDate,
        notes: newNotes.trim() || null,
      }),
    });
    setBusyId(null);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not add expense.");
      return;
    }

    setNewName("");
    setNewAmount("");
    setNewCurrency("KES");
    setNewCycle("monthly");
    setNewDueDate("");
    setNewNotes("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {expenses.length === 0 && (
        <p className="rounded-2xl border border-gold-500/20 bg-surface p-6 text-sm text-ink/65 shadow-card">
          No expenses tracked yet.
        </p>
      )}

      {expenses.map((expense) => {
        const busy = busyId === expense.id;
        const dueSoon = isDueSoon(expense.next_due_date);
        return (
          <div
            key={expense.id}
            className={`rounded-2xl border p-5 shadow-card ${
              dueSoon ? "border-danger/30 bg-danger/5" : "border-gold-500/20 bg-surface"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1 space-y-3">
                <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
                  <div>
                    <label className="text-xs font-medium text-ink/65">Name</label>
                    <input
                      type="text"
                      defaultValue={expense.name}
                      disabled={busy}
                      onBlur={(e) => {
                        if (e.target.value.trim() && e.target.value !== expense.name) {
                          patchExpense(expense.id, { name: e.target.value.trim() }).then(
                            (ok) => ok && updateLocal(expense.id, { name: e.target.value.trim() }),
                          );
                        }
                      }}
                      className="focus-ring mt-1 w-full rounded-lg border border-gold-500/25 bg-page px-3 py-2 text-sm text-ink"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-ink/65">Amount</label>
                    <div className="mt-1 flex gap-1.5">
                      <input
                        type="number"
                        step="0.01"
                        defaultValue={expense.amount ?? ""}
                        disabled={busy}
                        placeholder="—"
                        onBlur={(e) => {
                          const val = e.target.value.trim() ? Number(e.target.value) : null;
                          if (val !== expense.amount) {
                            patchExpense(expense.id, { amount: val }).then(
                              (ok) => ok && updateLocal(expense.id, { amount: val }),
                            );
                          }
                        }}
                        className="focus-ring w-full rounded-lg border border-gold-500/25 bg-page px-2.5 py-2 text-sm text-ink"
                      />
                      <input
                        type="text"
                        defaultValue={expense.currency}
                        disabled={busy}
                        onBlur={(e) => {
                          if (e.target.value.trim() && e.target.value !== expense.currency) {
                            patchExpense(expense.id, { currency: e.target.value.trim() }).then(
                              (ok) =>
                                ok && updateLocal(expense.id, { currency: e.target.value.trim() }),
                            );
                          }
                        }}
                        className="focus-ring w-16 shrink-0 rounded-lg border border-gold-500/25 bg-page px-2 py-2 text-sm text-ink"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-ink/65">Billing cycle</label>
                    <select
                      value={expense.billing_cycle}
                      disabled={busy}
                      onChange={(e) => {
                        const value = e.target.value as BillingCycle;
                        patchExpense(expense.id, { billingCycle: value }).then(
                          (ok) => ok && updateLocal(expense.id, { billing_cycle: value }),
                        );
                      }}
                      className="focus-ring mt-1 w-full rounded-lg border border-gold-500/25 bg-page px-2.5 py-2 text-sm text-ink"
                    >
                      {CYCLES.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
                  <div>
                    <label className="text-xs font-medium text-ink/65">Next due date</label>
                    <input
                      type="date"
                      defaultValue={expense.next_due_date}
                      disabled={busy}
                      onBlur={(e) => {
                        if (e.target.value && e.target.value !== expense.next_due_date) {
                          patchExpense(expense.id, { nextDueDate: e.target.value }).then(
                            (ok) =>
                              ok && updateLocal(expense.id, { next_due_date: e.target.value }),
                          );
                        }
                      }}
                      className="focus-ring mt-1 w-full rounded-lg border border-gold-500/25 bg-page px-2.5 py-2 text-sm text-ink"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-ink/65">Notes</label>
                    <input
                      type="text"
                      defaultValue={expense.notes ?? ""}
                      disabled={busy}
                      placeholder="Optional"
                      onBlur={(e) => {
                        if (e.target.value !== (expense.notes ?? "")) {
                          patchExpense(expense.id, { notes: e.target.value }).then(
                            (ok) =>
                              ok && updateLocal(expense.id, { notes: e.target.value || null }),
                          );
                        }
                      }}
                      className="focus-ring mt-1 w-full rounded-lg border border-gold-500/25 bg-page px-3 py-2 text-sm text-ink"
                    />
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleDelete(expense.id)}
                disabled={busy}
                aria-label="Delete expense"
                className="focus-ring shrink-0 rounded-full p-2 text-danger hover:bg-danger/10 disabled:opacity-30"
              >
                <Trash size={18} />
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs">
              {dueSoon && (
                <span className="flex items-center gap-1 font-semibold text-danger">
                  <Warning size={14} /> Due {format(parseISO(expense.next_due_date), "d MMM yyyy")}
                </span>
              )}
              <span className="text-ink/55">{formatAmount(expense.amount, expense.currency)}</span>
            </div>
          </div>
        );
      })}

      <form
        onSubmit={handleAdd}
        className="rounded-2xl border border-gold-500/20 bg-surface p-5 shadow-card"
      >
        <h2 className="font-serif text-base font-semibold text-ink">Add an expense</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-[2fr_1fr_1fr_1fr]">
          <input
            type="text"
            required
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Domain (.store)"
            className="focus-ring rounded-lg border border-gold-500/25 bg-page px-3 py-2 text-sm text-ink"
          />
          <input
            type="number"
            step="0.01"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            placeholder="Amount"
            className="focus-ring rounded-lg border border-gold-500/25 bg-page px-3 py-2 text-sm text-ink"
          />
          <input
            type="text"
            value={newCurrency}
            onChange={(e) => setNewCurrency(e.target.value)}
            placeholder="Currency"
            className="focus-ring rounded-lg border border-gold-500/25 bg-page px-3 py-2 text-sm text-ink"
          />
          <select
            value={newCycle}
            onChange={(e) => setNewCycle(e.target.value as BillingCycle)}
            className="focus-ring rounded-lg border border-gold-500/25 bg-page px-2.5 py-2 text-sm text-ink"
          >
            {CYCLES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_2fr]">
          <input
            type="date"
            required
            value={newDueDate}
            onChange={(e) => setNewDueDate(e.target.value)}
            className="focus-ring rounded-lg border border-gold-500/25 bg-page px-2.5 py-2 text-sm text-ink"
          />
          <input
            type="text"
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="focus-ring rounded-lg border border-gold-500/25 bg-page px-3 py-2 text-sm text-ink"
          />
        </div>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={busyId === "new"}
          className="focus-ring mt-4 flex items-center gap-1.5 rounded-full bg-terracotta-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-terracotta-600 disabled:opacity-60"
        >
          <Plus size={14} /> {busyId === "new" ? "Adding…" : "Add Expense"}
        </button>
      </form>
    </div>
  );
}
