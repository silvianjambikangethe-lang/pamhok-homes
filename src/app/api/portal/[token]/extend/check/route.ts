import { NextResponse } from "next/server";
import { addDays, format } from "date-fns";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { releaseExpiredExtensionHold } from "@/lib/extension-hold";

const SELECT =
  "id, room_id, check_out, total_amount, payment_status, id_verification_status, checked_out_at, pending_extension_check_out, pending_extension_amount, pending_extension_requested_at, room:rooms(price_per_night, currency)";

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

  let { data: booking, error } = await supabase
    .from("bookings")
    .select(SELECT)
    .eq("access_token", token)
    .maybeSingle();

  if (error || !booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  if (await releaseExpiredExtensionHold(supabase, booking)) {
    ({ data: booking, error } = await supabase
      .from("bookings")
      .select(SELECT)
      .eq("access_token", token)
      .maybeSingle());
    if (error || !booking) {
      return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    }
  }

  if (booking.id_verification_status !== "Verified" || booking.checked_out_at || !booking.room_id) {
    return NextResponse.json({ error: "Extension isn't available for this booking." }, { status: 403 });
  }

  if (booking.payment_status !== "Paid") {
    return NextResponse.json({
      available: false,
      message: "Your current stay needs to be fully paid before you can request more nights.",
    });
  }

  if (booking.pending_extension_check_out) {
    return NextResponse.json({
      available: false,
      message: "You already have an extension awaiting payment — complete that payment before requesting more nights.",
    });
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
