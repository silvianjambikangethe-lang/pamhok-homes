import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// Polled by LaundrySection (see usePollRefresh) so a guest sees staff/admin
// laundry updates — stage advances, a price being set, payment being
// confirmed — without reloading the page themselves.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const supabase = createAdminSupabaseClient();

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id")
    .eq("access_token", token)
    .maybeSingle();

  if (bookingError || !booking) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: request } = await supabase
    .from("guest_requests")
    .select("status, laundry_payment_status, updated_at")
    .eq("booking_id", booking.id)
    .eq("request_type", "laundry")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    status: request?.status ?? null,
    laundryPaymentStatus: request?.laundry_payment_status ?? null,
    updatedAt: request?.updated_at ?? null,
  });
}
