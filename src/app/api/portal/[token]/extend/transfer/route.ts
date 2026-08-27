import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { generateBookingReference, generatePassReference } from "@/lib/booking-reference";

// Offered when a guest wants to extend but their current room isn't free
// for the extra nights (see extend/check's alternateRooms). Rather than a
// dead end, this creates a genuinely separate, fresh booking in a
// different room, starting the moment their current stay ends — its own
// check_in/check_out, its own door code/WiFi (that room's, not carried
// over), and its own guest_requests history, so laundry/cleaning tracking
// starts clean for the new room rather than inheriting the old one's
// state. The guest is a known quantity (already ID-verified, currently
// staying), so id_verification_status is copied over rather than making
// them re-upload a photo of the same ID for the same stay — but
// terms_accepted_at is deliberately left unset and payment starts
// Pending, same as any other booking.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const body = await request.json().catch(() => null);
  const roomId = typeof body?.roomId === "string" ? body.roomId : null;
  const checkOut = typeof body?.checkOut === "string" ? body.checkOut : null;

  if (!roomId || !checkOut) {
    return NextResponse.json({ error: "Missing room or checkout date." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();

  const { data: booking, error } = await supabase
    .from("bookings")
    .select("id, guest_id, check_out, payment_status, id_verification_status, id_verification_method, checked_out_at")
    .eq("access_token", token)
    .maybeSingle();

  if (error || !booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  if (
    booking.id_verification_status !== "Verified" ||
    booking.payment_status !== "Paid" ||
    booking.checked_out_at ||
    !booking.guest_id
  ) {
    return NextResponse.json({ error: "Room transfer isn't available for this booking." }, { status: 403 });
  }

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .eq("is_active", true)
    .maybeSingle();

  if (roomError || !room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  // Re-validate at transfer time too — the alternate-rooms list a moment
  // ago doesn't hold a lock, so someone else could have booked in between.
  const { data: conflicts, error: availError } = await supabase
    .from("availability_view")
    .select("check_in")
    .eq("room_id", roomId)
    .lt("check_in", checkOut)
    .gt("check_out", booking.check_out);

  if (availError) {
    return NextResponse.json({ error: "Could not verify availability." }, { status: 500 });
  }
  if (conflicts && conflicts.length > 0) {
    return NextResponse.json(
      { error: "That room was just booked for those dates. Please pick another." },
      { status: 409 },
    );
  }

  const nights = Math.round(
    (new Date(checkOut).getTime() - new Date(booking.check_out).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (!Number.isInteger(nights) || nights < 1) {
    return NextResponse.json({ error: "Invalid date range." }, { status: 400 });
  }
  const totalAmount = nights * room.price_per_night;

  let newBooking: { access_token: string; booking_reference: string | null } | null = null;
  for (let attempt = 0; attempt < 5 && !newBooking; attempt++) {
    const { data, error: insertError } = await supabase
      .from("bookings")
      .insert({
        room_id: room.id,
        guest_id: booking.guest_id,
        check_in: booking.check_out,
        check_out: checkOut,
        total_amount: totalAmount,
        currency: room.currency,
        payment_status: "Pending",
        booking_status: "Confirmed",
        booking_reference: generateBookingReference(),
        pass_reference: generatePassReference(booking.check_out, room.display_order),
        id_verification_status: "Verified",
        id_verification_method: booking.id_verification_method ?? "Manual",
      })
      .select("access_token, booking_reference")
      .single();

    if (data) {
      newBooking = data;
    } else if (insertError?.code !== "23505") {
      return NextResponse.json({ error: "Could not create the new booking." }, { status: 500 });
    }
  }

  if (!newBooking) {
    return NextResponse.json({ error: "Could not create the new booking." }, { status: 500 });
  }

  await supabase.from("guest_requests").insert({
    booking_id: booking.id,
    request_type: "extension",
    message: `Guest moved to ${room.name} for extra nights (their current room wasn't free) — new booking ${newBooking.booking_reference}, ${booking.check_out} to ${checkOut}, awaiting payment.`,
    status: "Open",
  });

  return NextResponse.json({
    ok: true,
    accessToken: newBooking.access_token,
    bookingReference: newBooking.booking_reference,
  });
}
