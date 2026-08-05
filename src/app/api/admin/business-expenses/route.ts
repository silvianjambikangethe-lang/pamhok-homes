import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const VALID_CYCLES = ["monthly", "annual", "one-time"] as const;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const nextDueDate = typeof body?.nextDueDate === "string" ? body.nextDueDate : "";
  const billingCycle = body?.billingCycle;

  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }
  if (!VALID_CYCLES.includes(billingCycle)) {
    return NextResponse.json({ error: "Invalid billing cycle." }, { status: 400 });
  }
  if (!nextDueDate || Number.isNaN(Date.parse(nextDueDate))) {
    return NextResponse.json({ error: "A valid next due date is required." }, { status: 400 });
  }

  const amount =
    typeof body?.amount === "number" && Number.isFinite(body.amount) ? body.amount : null;
  const currency = typeof body?.currency === "string" && body.currency.trim() ? body.currency.trim() : "KES";
  const notes = typeof body?.notes === "string" ? body.notes.trim() || null : null;

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("business_expenses")
    .insert({
      name,
      amount,
      currency,
      billing_cycle: billingCycle,
      next_due_date: nextDueDate,
      notes,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Not authorized, or could not add expense." },
      { status: 403 },
    );
  }

  return NextResponse.json({ ok: true, id: data.id });
}
