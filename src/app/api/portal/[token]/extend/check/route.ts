import { NextResponse } from "next/server";
import { addDays, format } from "date-fns";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const body = await request.json().catch(() => null);
  const additionalNights = Number(body?.additionalNights);

  if (!Number.isInteger(additionalNights) || additionalNights < 1 || additionalNights > 14) {
    return NextResponse.json({ error: "Choose between 1 and 14 nights." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();

  const { data: booking, error } = await supabase
    .from("bookings")
    .select("room_id, check_out, id_verification_status, checked_out_at, room:rooms(price_per_night, currency)")
    .eq("access_token", token)
    .maybeSingle();

  if (error || !booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  if (booking.id_verification_status !== "Verified" || booking.checked_out_at || !booking.room_id) {
    return NextResponse.json({ error: "Extension isn't available for this booking." }, { status: 403 });
  }

  const newCheckOut = format(addDays(new Date(booking.check_out), additionalNights), "yyyy-MM-dd");

  const { data: conflicts, error: availError } = await supabase
    .from("availability_view")
    .select("check_in, check_out")
    .eq("room_id", booking.room_id)
    .lt("check_in", newCheckOut)
    .gt("check_out", booking.check_out);

  if (availError) {
    return NextResponse.json({ error: "Could not check availability." }, { status: 500 });
  }

  const room = (booking as unknown as { room?: { price_per_night?: number; currency?: string } }).room;
  const pricePerNight = room?.price_per_night ?? 0;

  if (conflicts && conflicts.length > 0) {
    return NextResponse.json({
      available: false,
      message: "Those extra nights aren't available — another guest is booked next.",
    });
  }

  return NextResponse.json({
    available: true,
    newCheckOut,
    additionalCost: additionalNights * pricePerNight,
    currency: room?.currency ?? "KES",
  });
}
