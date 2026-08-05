import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { BusinessExpense } from "@/lib/supabase/types";

const VALID_CYCLES = ["monthly", "annual", "one-time"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);

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

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

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
