import { NextResponse } from "next/server";
import { addDays, format } from "date-fns";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";

// Runs daily via vercel.json's cron entry. Finds every business_expense due
// in exactly 3 days and emails every admin_users row a single summary.
// The live "Renewals due soon" card on /admin/expenses already surfaces
// this visually on every dashboard visit — this is the proactive channel
// for renewals nobody happens to check the dashboard in time to see
// (e.g. a domain with auto-renewal deliberately left off).
//
// isAuthorized mirrors checkout-reminders/cleaning-notices: Vercel Cron
// itself authenticates with `Authorization: Bearer $CRON_SECRET`, not a
// custom header — this route previously checked ONLY `x-cron-secret`,
// which meant Vercel's actual daily trigger would always have gotten a
// 401 and never really run, even with a real email step wired up.

function isAuthorized(request: Request): boolean {
  if (!process.env.CRON_SECRET) return true;
  const bearer = request.headers.get("authorization");
  if (bearer === `Bearer ${process.env.CRON_SECRET}`) return true;
  return request.headers.get("x-cron-secret") === process.env.CRON_SECRET;
}

interface DueExpense {
  id: string;
  name: string;
  amount: number | null;
  currency: string;
  next_due_date: string;
  notes: string | null;
}

function formatAmount(expense: DueExpense): string {
  if (expense.amount === null) return "an unknown amount";
  try {
    return new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: expense.currency,
      maximumFractionDigits: 0,
    }).format(expense.amount);
  } catch {
    return `${expense.currency} ${expense.amount}`;
  }
}

function reminderEmail(expenses: DueExpense[]): { subject: string; html: string } {
  const subject =
    expenses.length === 1
      ? `Renewal due in 3 days — ${expenses[0].name}`
      : `${expenses.length} renewals due in 3 days`;

  const items = expenses
    .map(
      (e) =>
        `<li style="margin-bottom: 10px;"><strong>${e.name}</strong> — ${formatAmount(e)}, due ${e.next_due_date}${e.notes ? `<br /><span style="color:#8a7d6e; font-size: 13px;">${e.notes}</span>` : ""}</li>`,
    )
    .join("");

  const html = `<div style="background:#FBF7F1; padding:32px 16px;">
    <style>@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@600&family=Plus+Jakarta+Sans:wght@400;600&display=swap');</style>
    <div style="font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #2a2118; font-size: 15px; line-height: 1.6;">
      <h1 style="font-family: Fraunces, Georgia, serif; font-weight: 600; font-size: 22px; margin: 0 0 20px;">Renewal reminder</h1>
      <p>The following renews in 3 days:</p>
      <ul style="padding-left: 18px;">${items}</ul>
      <p style="margin-top: 24px; font-size: 13px; color: #8a7d6e;">Manage these in /admin/expenses.</p>
    </div>
  </div>`;

  return { subject, html };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const dueInThreeDays = format(addDays(new Date(), 3), "yyyy-MM-dd");

  const { data: dueExpenses } = await supabase
    .from("business_expenses")
    .select("id, name, amount, currency, next_due_date, notes")
    .eq("next_due_date", dueInThreeDays);

  let emailsSent = 0;
  if (dueExpenses && dueExpenses.length > 0) {
    const { data: admins } = await supabase.from("admin_users").select("email");
    const { subject, html } = reminderEmail(dueExpenses);
    const results = await Promise.all(
      (admins ?? []).map((admin) => sendEmail({ to: admin.email, subject, html })),
    );
    emailsSent = results.filter(Boolean).length;
  }

  return NextResponse.json({
    ok: true,
    dueInThreeDaysCount: dueExpenses?.length ?? 0,
    emailsSent,
  });
}
