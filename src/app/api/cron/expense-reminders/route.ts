import { NextResponse } from "next/server";
import { addDays, format } from "date-fns";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// DORMANT: this endpoint computes which business expenses are due in
// exactly 3 days, but the actual "send" step only logs — there's no
// external notification provider wired up (same reasoning as
// checkout-reminders), and the live "Renewals due soon" card on
// /admin already surfaces this on every dashboard visit without needing
// any cron at all. This route exists for a FUTURE external channel
// (email/SMS) if one gets added later. Once one exists:
//   1. Point a scheduler at this URL once daily.
//   2. Replace `sendReminder`'s console.log with a real provider call.
//   3. This route already checks a shared secret against
//      process.env.CRON_SECRET, same as checkout-reminders.
//
// Until then, the *logic* here is real and correct — it's only the
// delivery mechanism that's missing.

async function sendReminder(expense: {
  id: string;
  name: string;
  amount: number | null;
  currency: string;
  next_due_date: string;
}) {
  const amountText =
    expense.amount !== null
      ? new Intl.NumberFormat("en-KE", {
          style: "currency",
          currency: expense.currency,
          maximumFractionDigits: 0,
        }).format(expense.amount)
      : "an unknown amount";

  // TODO: replace with a real notification provider once one is chosen.
  console.log(
    `[dormant] ${expense.name} renews in 3 days — ${amountText} due ${expense.next_due_date}.`,
  );
}

export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const dueInThreeDays = format(addDays(new Date(), 3), "yyyy-MM-dd");

  const { data: dueExpenses } = await supabase
    .from("business_expenses")
    .select("id, name, amount, currency, next_due_date")
    .eq("next_due_date", dueInThreeDays);

  await Promise.all((dueExpenses ?? []).map(sendReminder));

  return NextResponse.json({
    ok: true,
    dormant: true,
    dueInThreeDaysCount: dueExpenses?.length ?? 0,
  });
}
