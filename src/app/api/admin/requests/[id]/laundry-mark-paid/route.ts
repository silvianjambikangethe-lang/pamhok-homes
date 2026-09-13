import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// For cash/bank-transfer handled in person — mirrors the existing
// booking-payment "Mark Paid" pattern (/api/admin/bookings/[id]/mark-paid).
// Never touches status directly: paying doesn't move the item, returning
// it does (staff/admin still take that as its own explicit step, now
// unblocked once this runs).
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: current, error: fetchError } = await supabase
    .from("guest_requests")
    .select("id, laundry_amount, laundry_payment_status")
    .eq("id", id)
    .eq("request_type", "laundry")
    .maybeSingle();

  if (fetchError || !current) {
    return NextResponse.json({ error: "Not authorized or not found." }, { status: 403 });
  }

  if (!current.laundry_amount) {
    return NextResponse.json({ error: "No price has been set yet." }, { status: 409 });
  }

  if (current.laundry_payment_status === "Paid") {
    return NextResponse.json({ error: "Already marked paid." }, { status: 409 });
  }

  const { error: updateError } = await supabase
    .from("guest_requests")
    .update({
      laundry_payment_status: "Paid",
      laundry_payment_method: "manual",
      laundry_paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: "Could not mark as paid." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
