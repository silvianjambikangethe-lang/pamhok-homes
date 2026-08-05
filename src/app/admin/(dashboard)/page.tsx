import Link from "next/link";
import { addDays, endOfMonth, format, startOfMonth } from "date-fns";
import {
  Bell,
  CalendarCheck,
  ChatCircleDots,
  CurrencyDollar,
  Warning,
  ArrowCounterClockwise,
  Receipt,
} from "@phosphor-icons/react/dist/ssr";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function formatExpenseAmount(amount: number | null, currency: string) {
  if (amount === null) return null;
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

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function AdminOverviewPage() {
  const supabase = await createServerSupabaseClient();

  const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(new Date()), "yyyy-MM-dd");

  const [
    { data: monthBookings },
    { data: pendingVerifications },
    { data: openRequests },
    { data: refundsNeeded },
    { data: renewalsDueSoon },
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, total_amount, payment_status, booking_status, created_at")
      .gte("created_at", monthStart)
      .lte("created_at", `${monthEnd}T23:59:59`),
    supabase
      .from("bookings")
      .select("id, guest:guests(full_name), room:rooms(name), created_at")
      .eq("id_verification_status", "Pending")
      // Only escalated (retries exhausted) — matches /admin/verifications.
      .eq("booking_status", "Pending Verification")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("guest_requests")
      .select("id, request_type, message, created_at, booking:bookings(room:rooms(name))")
      .eq("status", "Open")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("bookings")
      .select("id, booking_reference, refund_status, guest:guests(full_name)")
      .not("refund_status", "is", null)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("business_expenses")
      .select("id, name, amount, currency, next_due_date")
      .lte("next_due_date", format(addDays(new Date(), 3), "yyyy-MM-dd"))
      .order("next_due_date", { ascending: true })
      .limit(5),
  ]);

  const bookingsThisMonth = (monthBookings ?? []).filter(
    (b) => b.booking_status !== "Blocked",
  ).length;
  const revenueThisMonth = (monthBookings ?? [])
    .filter((b) => b.payment_status === "Paid")
    .reduce((sum, b) => sum + Number(b.total_amount), 0);
  const pendingUnpaid = (monthBookings ?? []).filter(
    (b) => b.payment_status !== "Paid" && b.booking_status !== "Blocked",
  ).length;

  const stats = [
    {
      label: "Bookings this month",
      value: bookingsThisMonth,
      icon: CalendarCheck,
    },
    {
      label: "Revenue this month",
      value: formatCurrency(revenueThisMonth),
      icon: CurrencyDollar,
    },
    {
      label: "Pending / unpaid",
      value: pendingUnpaid,
      icon: Warning,
    },
  ];

  return (
    <div>
      <h1 className="font-serif text-h2 text-ink">Overview</h1>

      <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-5">
        {stats.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="@container min-w-0 rounded-2xl border border-gold-500/20 bg-surface p-6 shadow-card"
          >
            <div className="flex min-w-0 flex-col items-start gap-3 @[13rem]:flex-row @[13rem]:items-center @[13rem]:gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-terracotta-50 text-terracotta-600 dark:bg-terracotta-700/30 dark:text-terracotta-300">
                <Icon size={24} weight="light" />
              </div>
              <div className="min-w-0">
                <p className="break-words text-[clamp(1.25rem,4cqi,1.5rem)] font-semibold text-ink">
                  {value}
                </p>
                <p className="text-sm text-ink/65">{label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        <div
          className={`rounded-2xl border p-6 shadow-card ${
            pendingVerifications && pendingVerifications.length > 0
              ? "border-danger/30 bg-danger/5"
              : "border-gold-500/20 bg-surface"
          }`}
        >
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-serif text-lg font-semibold text-ink">
              <Bell size={20} className="text-danger" />
              Pending ID verifications
            </h2>
            {pendingVerifications && pendingVerifications.length > 0 && (
              <span className="rounded-full bg-danger px-2.5 py-0.5 text-xs font-semibold text-white">
                {pendingVerifications.length}
              </span>
            )}
          </div>
          {pendingVerifications && pendingVerifications.length > 0 && (
            <p className="mt-1 text-xs font-semibold text-danger">
              Guest dates held — needs your review
            </p>
          )}
          <ul className="mt-4 space-y-3">
            {(pendingVerifications ?? []).length === 0 && (
              <p className="text-sm text-ink/65">Nothing pending — all caught up.</p>
            )}
            {(pendingVerifications ?? []).map((b) => (
              <li key={b.id} className="flex items-center justify-between text-sm">
                <span className="text-ink/80">
                  {(b as unknown as { guest?: { full_name?: string } }).guest?.full_name ??
                    "Guest"}{" "}
                  ·{" "}
                  {(b as unknown as { room?: { name?: string } }).room?.name ?? "Room"}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href="/admin/verifications"
            className="focus-ring mt-4 inline-block text-sm font-semibold text-terracotta-600 hover:text-terracotta-700"
          >
            Review all →
          </Link>
        </div>

        <div className="rounded-2xl border border-gold-500/20 bg-surface p-6 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-serif text-lg font-semibold text-ink">
              <ChatCircleDots size={20} className="text-terracotta-600" />
              Guest requests
            </h2>
            {openRequests && openRequests.length > 0 && (
              <span className="rounded-full bg-terracotta-500 px-2.5 py-0.5 text-xs font-semibold text-white">
                {openRequests.length}
              </span>
            )}
          </div>
          <ul className="mt-4 space-y-3">
            {(openRequests ?? []).length === 0 && (
              <p className="text-sm text-ink/65">No open requests right now.</p>
            )}
            {(openRequests ?? []).map((r) => (
              <li key={r.id} className="text-sm">
                <p className="font-medium capitalize text-ink/80">{r.request_type}</p>
                {r.message && <p className="text-ink/65">{r.message}</p>}
              </li>
            ))}
          </ul>
          <Link
            href="/admin/requests"
            className="focus-ring mt-4 inline-block text-sm font-semibold text-terracotta-600 hover:text-terracotta-700"
          >
            View all →
          </Link>
        </div>

        <div
          className={`rounded-2xl border p-6 shadow-card ${
            refundsNeeded && refundsNeeded.length > 0
              ? "border-danger/30 bg-danger/5"
              : "border-gold-500/20 bg-surface"
          }`}
        >
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-serif text-lg font-semibold text-ink">
              <ArrowCounterClockwise size={20} className="text-danger" />
              Refunds needed
            </h2>
            {refundsNeeded && refundsNeeded.length > 0 && (
              <span className="rounded-full bg-danger px-2.5 py-0.5 text-xs font-semibold text-white">
                {refundsNeeded.length}
              </span>
            )}
          </div>
          <ul className="mt-4 space-y-3">
            {(refundsNeeded ?? []).length === 0 && (
              <p className="text-sm text-ink/65">No refunds waiting on you.</p>
            )}
            {(refundsNeeded ?? []).map((b) => (
              <li key={b.id} className="text-sm">
                <p className="font-medium text-ink/80">
                  {(b as unknown as { guest?: { full_name?: string } }).guest?.full_name ??
                    "Guest"}{" "}
                  · {b.booking_reference ?? "—"}
                </p>
                <p className="text-ink/65">{b.refund_status}</p>
              </li>
            ))}
          </ul>
          <Link
            href="/admin/bookings"
            className="focus-ring mt-4 inline-block text-sm font-semibold text-terracotta-600 hover:text-terracotta-700"
          >
            Go to Bookings →
          </Link>
        </div>

        <div
          className={`rounded-2xl border p-6 shadow-card ${
            renewalsDueSoon && renewalsDueSoon.length > 0
              ? "border-danger/30 bg-danger/5"
              : "border-gold-500/20 bg-surface"
          }`}
        >
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-serif text-lg font-semibold text-ink">
              <Receipt size={20} className="text-danger" />
              Renewals due soon
            </h2>
            {renewalsDueSoon && renewalsDueSoon.length > 0 && (
              <span className="rounded-full bg-danger px-2.5 py-0.5 text-xs font-semibold text-white">
                {renewalsDueSoon.length}
              </span>
            )}
          </div>
          <ul className="mt-4 space-y-3">
            {(renewalsDueSoon ?? []).length === 0 && (
              <p className="text-sm text-ink/65">Nothing due in the next 3 days.</p>
            )}
            {(renewalsDueSoon ?? []).map((expense) => {
              const amount = formatExpenseAmount(expense.amount, expense.currency);
              return (
                <li key={expense.id} className="text-sm">
                  <p className="font-medium text-ink/80">{expense.name}</p>
                  <p className="text-ink/65">
                    Due {format(new Date(expense.next_due_date), "d MMM yyyy")}
                    {amount ? ` · ${amount}` : ""}
                  </p>
                </li>
              );
            })}
          </ul>
          <Link
            href="/admin/expenses"
            className="focus-ring mt-4 inline-block text-sm font-semibold text-terracotta-600 hover:text-terracotta-700"
          >
            Go to Expenses →
          </Link>
        </div>
      </div>
    </div>
  );
}
