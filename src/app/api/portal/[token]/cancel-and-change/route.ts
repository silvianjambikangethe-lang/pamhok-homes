import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const supabase = createAdminSupabaseClient();

  const { data: booking, error } = await supabase
    .from("bookings")
    .select("id, check_in, check_out, payment_status, id_verification_status, booking_status")
    .eq("access_token", token)
    .single();

  if (error || !booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  if (booking.payment_status === "Paid") {
    return NextResponse.json(
      { error: "This booking has already been paid and cannot be cancelled here." },
      { status: 400 },
    );
  }

  if (booking.id_verification_status !== "Verified") {
    return NextResponse.json(
      { error: "ID must be verified to use this option." },
      { status: 400 },
    );
  }

  // Already cancelled on a prior attempt — still return dates so the redirect works.
  if (booking.booking_status === "Cancelled") {
    return NextResponse.json({ checkIn: booking.check_in, checkOut: booking.check_out });
  }

  const { error: updateError } = await supabase
    .from("bookings")
    .update({ booking_status: "Cancelled" })
    .eq("id", booking.id);

  if (updateError) {
    return NextResponse.json(
      { error: "Could not cancel booking. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ checkIn: booking.check_in, checkOut: booking.check_out });
}
