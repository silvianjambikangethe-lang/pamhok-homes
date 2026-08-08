import { NextResponse } from "next/server";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { generateBookingReference, generatePassReference } from "@/lib/booking-reference";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (
    !body ||
    typeof body.roomId !== "string" ||
    typeof body.checkIn !== "string" ||
    typeof body.checkOut !== "string" ||
    typeof body.guestName !== "string" ||
    !body.guestName.trim() ||
    body.guestName.trim().length > 200
  ) {
    return NextResponse.json({ error: "Missing fields." }, { status: 400 });
  }

  const nights = differenceInCalendarDays(parseISO(body.checkOut), parseISO(body.checkIn));
  if (!Number.isFinite(nights) || nights < 1) {
    return NextResponse.json({ error: "Invalid date range." }, { status: 400 });
  }

  // This route marks bookings Paid + Verified with none of the public
  // flow's safeguards (payment gateway, ID verification) — unlike the
  // low-stakes block-dates route, an unauthenticated caller here could
  // otherwise create real-looking bookings that lock out actual guests
  // for free. Confirm admin_users membership before touching the
  // service-role client below (same pattern as the password-change
  // route), then use service-role for the actual writes — guests has a
  // known RLS anomaly (documented in HANDOFF.md) that rejects even
  // legitimate admin inserts.
  const authClient = await createServerSupabaseClient();
  const {
    data: { session },
  } = await authClient.auth.getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  const { data: adminRow } = await authClient
    .from("admin_users")
    .select("id")
    .eq("id", session.user.id)
    .maybeSingle();
  if (!adminRow) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const supabase = createAdminSupabaseClient();

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, currency, price_per_night, display_order, name")
    .eq("id", body.roomId)
    .eq("is_active", true)
    .maybeSingle();

  if (roomError || !room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  const { data: guestRow, error: guestError } = await supabase
    .from("guests")
    .insert({ full_name: body.guestName.trim() })
    .select("id")
    .single();

  if (guestError || !guestRow) {
    return NextResponse.json({ error: "Could not save guest details." }, { status: 500 });
  }

  let booking: {
    booking_reference: string | null;
    check_in: string;
    check_out: string;
  } | null = null;

  // booking_reference has a unique constraint — retry a few times on the
  // astronomically rare collision, same as the public booking endpoint.
  for (let attempt = 0; attempt < 5 && !booking; attempt++) {
    const { data, error: bookingError } = await supabase
      .from("bookings")
      .insert({
        room_id: room.id,
        guest_id: guestRow.id,
        check_in: body.checkIn,
        check_out: body.checkOut,
        total_amount: nights * room.price_per_night,
        currency: room.currency,
        payment_status: "Paid",
        payment_method: "manual",
        booking_status: "Confirmed",
        id_verification_status: "Verified",
        id_verification_method: "manual_override",
        booking_reference: generateBookingReference(),
        pass_reference: generatePassReference(body.checkIn, room.display_order),
      })
      .select("booking_reference, check_in, check_out")
      .single();

    if (data) {
      booking = data;
    } else if (bookingError?.code !== "23505") {
      return NextResponse.json(
        { error: "Could not create booking — dates may already be taken." },
        { status: 409 },
      );
    }
  }

  if (!booking) {
    return NextResponse.json({ error: "Could not create booking." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    guestCard: {
      roomName: room.name,
      guestName: body.guestName.trim(),
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      bookingReference: booking.booking_reference,
    },
  });
}
