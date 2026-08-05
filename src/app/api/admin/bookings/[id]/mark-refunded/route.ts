import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Closes the loop on a refund that needed manual action (M-Pesa has no
// refund API wired up, or a PayPal auto-refund attempt failed) — the
// admin sends the money themselves, then confirms it here.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const reference = typeof body?.reference === "string" ? body.reference : "manual";

  const supabase = await createServerSupabaseClient();

  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("id, total_amount")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !booking) {
    return NextResponse.json({ error: "Not authorized or booking not found." }, { status: 403 });
  }

  const { error } = await supabase
    .from("bookings")
    .update({
      payment_status: "Refunded",
      refund_status: null,
      refund_reference: reference,
      refund_amount: Number(booking.total_amount),
      refunded_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Could not mark booking as refunded." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
