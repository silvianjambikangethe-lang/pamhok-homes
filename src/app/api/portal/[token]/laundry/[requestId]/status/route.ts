import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// Polled by LaundryPaymentSection while an M-Pesa STK push is pending —
// mirrors /api/portal/[token]/status's role for the booking's own
// payment, scoped to one laundry request instead.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; requestId: string }> },
) {
  const { token, requestId } = await params;
  const supabase = createAdminSupabaseClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id")
    .eq("access_token", token)
    .maybeSingle();

  if (!booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  const { data: request, error } = await supabase
    .from("guest_requests")
    .select("laundry_payment_status")
    .eq("id", requestId)
    .eq("booking_id", booking.id)
    .eq("request_type", "laundry")
    .maybeSingle();

  if (error || !request) {
    return NextResponse.json({ error: "Laundry request not found." }, { status: 404 });
  }

  return NextResponse.json(request);
}
