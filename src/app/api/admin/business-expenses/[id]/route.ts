import { NextResponse } from "next/server";
import { addMonths, addYears, format, parseISO, startOfDay } from "date-fns";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { BusinessExpense } from "@/lib/supabase/types";

const VALID_CYCLES = ["monthly", "annual", "one-time"];

// Advances a due date by whole billing cycles until it's back in the
// future — handles a bill that's several cycles overdue, not just one.
function nextDueDateAfterPaying(currentDueDate: string, cycle: string) {
  let due = parseISO(currentDueDate);
  const today = startOfDay(new Date());
  const advance = cycle === "annual" ? addYears : addMonths;
  do {
    due = advance(due, 1);
  } while (due <= today);
  return format(due, "yyyy-MM-dd");
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);

  if (typeof body?.name === "string" && body.name.trim().length > 200) {
    return NextResponse.json({ error: "Name is too long (max 200 chars)." }, { status: 400 });
  }
  if (typeof body?.currency === "string" && body.currency.trim().length > 10) {
    return NextResponse.json({ error: "Currency code is too long." }, { status: 400 });
  }
  if (typeof body?.notes === "string" && body.notes.length > 2000) {
    return NextResponse.json({ error: "Notes are too long (max 2000 chars)." }, { status: 400 });
  }

  const update: Partial<BusinessExpense> = {};
  if (typeof body?.name === "string") update.name = body.name.trim();
  if (typeof body?.amount === "number" && Number.isFinite(body.amount)) update.amount = body.amount;
  if (body?.amount === null) update.amount = null;
  if (typeof body?.currency === "string") update.currency = body.currency.trim();
  if (typeof body?.billingCycle === "string") {
    if (!VALID_CYCLES.includes(body.billingCycle)) {
      return NextResponse.json({ error: "Invalid billing cycle." }, { status: 400 });
    }
    update.billing_cycle = body.billingCycle;
  }
  if (typeof body?.nextDueDate === "string") {
    if (Number.isNaN(Date.parse(body.nextDueDate))) {
      return NextResponse.json({ error: "Invalid due date." }, { status: 400 });
    }
    update.next_due_date = body.nextDueDate;
  }
  if (typeof body?.notes === "string") update.notes = body.notes.trim() || null;

  const supabase = await createServerSupabaseClient();

  // "Clear" button: records the payment and, for a recurring bill, rolls
  // next_due_date forward by a cycle (or several, if it's been overdue a
  // while) so clearing it also stops it nagging as due until the new date.
  // A one-time bill just gets last_paid_at — there's no next cycle to move
  // to; the admin deletes it separately once they're done with it.
  if (body?.markPaid === true) {
    const { data: current } = await supabase
      .from("business_expenses")
      .select("billing_cycle, next_due_date")
      .eq("id", id)
      .maybeSingle();
    if (!current) {
      return NextResponse.json({ error: "Not authorized or expense not found." }, { status: 403 });
    }
    update.last_paid_at = new Date().toISOString();
    if (current.billing_cycle === "monthly" || current.billing_cycle === "annual") {
      update.next_due_date = nextDueDateAfterPaying(current.next_due_date, current.billing_cycle);
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("business_expenses")
    .update(update)
    .eq("id", id)
    .select("id");

  if (error) {
    return NextResponse.json({ error: "Could not update expense." }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Not authorized or expense not found." }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("business_expenses")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    return NextResponse.json({ error: "Could not delete expense." }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Not authorized or expense not found." }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
