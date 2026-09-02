import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Booking } from "@/lib/supabase/types";

// Per the Terms (Section 6): every cancellation is confirmed with the
// admin by phone first, and any refund owed is sent manually by the
// admin outside the site (M-Pesa, bank transfer, PayPal dashboard,
// whatever fits) — nothing here calls a payment provider automatically.
// This route's only job is to flag that a refund is owed, the same way
// the ID-verification-rejection path already does, so it shows up on the
// Overview "Refunds needed" card and the Mark Refunded button appears —
// otherwise a cancelled-but-paid booking would silently need no action
// and the admin could forget to actually send the money back.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("id, payment_status")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !booking) {
    return NextResponse.json({ error: "Not authorized or booking not found." }, { status: 403 });
  }

  const update: Partial<Booking> = { booking_status: "Cancelled" };
  if (booking.payment_status === "Paid") {
    update.refund_status = "Needs Manual Refund";
  }

  const { data, error } = await supabase
    .from("bookings")
    .update(update)
    .eq("id", id)
    .select("id");

  if (error) {
    return NextResponse.json({ error: "Could not cancel booking." }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Not authorized or booking not found." }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
