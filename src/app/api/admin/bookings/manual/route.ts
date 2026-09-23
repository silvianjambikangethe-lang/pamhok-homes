import { NextResponse } from "next/server";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { generateBookingReference, generatePassReference } from "@/lib/booking-reference";
import { isNameBlocked } from "@/lib/guest-blocklist";
import { EMAIL_RE, PHONE_RE } from "@/lib/validation";
import { sendPaymentSucceededEmail } from "@/lib/booking-emails";

// Matches the public booking route's MAX_EXTRA_ROOMS — same reasoning, kept
// as a local copy since it's a bare number, not a shared regex/behavior.
const MAX_EXTRA_ROOMS = 9;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (
    !body ||
    typeof body.roomId !== "string" ||
    typeof body.checkIn !== "string" ||
    typeof body.checkOut !== "string" ||
    typeof body.guestName !== "string" ||
    !body.guestName.trim() ||
    body.guestName.trim().length > 100
  ) {
    return NextResponse.json({ error: "Missing fields." }, { status: 400 });
  }

  // Optional extra rooms — a walk-in group booked under one name, same
  // shape as the public booking route's group-booking support: one
  // booking per room, all sharing this guest and these dates.
  const extraRoomIds: string[] = Array.isArray(body.extraRoomIds) ? body.extraRoomIds : [];
  if (
    extraRoomIds.length > MAX_EXTRA_ROOMS ||
    !extraRoomIds.every((id) => typeof id === "string" && id.length > 0 && id.length <= 64) ||
    new Set(extraRoomIds).size !== extraRoomIds.length ||
    extraRoomIds.includes(body.roomId)
  ) {
    return NextResponse.json({ error: "Invalid room selection." }, { status: 400 });
  }

  // Optional — a walk-in guest can still be booked with just a name, same
  // as before. When given, they're what lets the guest actually reach
  // their own portal (self-checkin details, door code/WiFi, cleaning and
  // laundry requests) instead of relying on staff for everything.
  const guestEmail = typeof body.guestEmail === "string" ? body.guestEmail.trim() : "";
  const guestPhone = typeof body.guestPhone === "string" ? body.guestPhone.trim() : "";
  if (guestEmail && (guestEmail.length > 254 || !EMAIL_RE.test(guestEmail))) {
    return NextResponse.json({ error: "Enter a valid email, or leave it blank." }, { status: 400 });
  }
  if (guestPhone && !PHONE_RE.test(guestPhone)) {
    return NextResponse.json({ error: "Enter a valid phone number, or leave it blank." }, { status: 400 });
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

  // Same blocklist gate as the public booking route — the point of the
  // blocklist is to keep a name out regardless of channel, so a walk-in
  // entered here is checked too rather than only the guest-facing form.
  if (await isNameBlocked(supabase, body.guestName)) {
    return NextResponse.json(
      { error: "This name is on the blocked guest list. Remove it from the blocklist first if this is a mistake." },
      { status: 403 },
    );
  }

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, currency, price_per_night, display_order, name")
    .eq("id", body.roomId)
    .eq("is_active", true)
    .maybeSingle();

  if (roomError || !room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  let extraRooms: (typeof room)[] = [];
  if (extraRoomIds.length > 0) {
    const { data: extras, error: extrasError } = await supabase
      .from("rooms")
      .select("id, currency, price_per_night, display_order, name")
      .in("id", extraRoomIds)
      .eq("is_active", true);

    if (extrasError || !extras || extras.length !== extraRoomIds.length) {
      return NextResponse.json(
        { error: "One of the rooms you picked is no longer available." },
        { status: 404 },
      );
    }
    // Keep the order they were picked in.
    extraRooms = extraRoomIds.map((id) => extras.find((r) => r.id === id)!);
  }

  const { data: guestRow, error: guestError } = await supabase
    .from("guests")
    .insert({
      full_name: body.guestName.trim(),
      email: guestEmail || null,
      phone: guestPhone || null,
    })
    .select("id")
    .single();

  if (guestError || !guestRow) {
    return NextResponse.json({ error: "Could not save guest details." }, { status: 500 });
  }

  const guestId = guestRow.id;

  type CreatedBooking = {
    id: string;
    access_token: string;
    booking_reference: string | null;
    check_in: string;
    check_out: string;
  };
  const created: CreatedBooking[] = [];

  // Group booking is all-or-nothing, same as the public route: if any room
  // fails partway through, remove whatever was already created rather than
  // leaving a half-booked group behind.
  async function rollback() {
    if (created.length > 0) {
      await supabase.from("bookings").delete().in("id", created.map((b) => b.id));
    }
    await supabase.from("guests").delete().eq("id", guestId);
  }

  // The requested room first, so its portal is where the guest lands and
  // links to the others — same ordering/comment as the public route.
  for (const bookedRoom of [room, ...extraRooms]) {
    let booking: CreatedBooking | null = null;

    // booking_reference has a unique constraint — retry a few times on the
    // astronomically rare collision, same as the public booking endpoint.
    for (let attempt = 0; attempt < 5 && !booking; attempt++) {
      const { data, error: bookingError } = await supabase
        .from("bookings")
        .insert({
          room_id: bookedRoom.id,
          guest_id: guestId,
          check_in: body.checkIn,
          check_out: body.checkOut,
          total_amount: nights * bookedRoom.price_per_night,
          currency: bookedRoom.currency,
          payment_status: "Paid",
          payment_method: "manual",
          booking_status: "Confirmed",
          id_verification_status: "Verified",
          id_verification_method: "manual_override",
          // The portal page's "is this guest actually checked-in-ready"
          // gate (src/components/portal/PortalClient.tsx's
          // isVerifiedAndActive) checks paid_at being set, not just
          // payment_status — without this, a walk-in guest's Arrival
          // section, door code/WiFi, laundry, extend-stay, and checkout
          // never appear even though payment_status already reads "Paid".
          paid_at: new Date().toISOString(),
          booking_reference: generateBookingReference(),
          pass_reference: generatePassReference(body.checkIn, bookedRoom.display_order),
        })
        .select("id, access_token, booking_reference, check_in, check_out")
        .single();

      if (data) {
        booking = data;
      } else if (bookingError?.code !== "23505") {
        await rollback();
        return NextResponse.json(
          { error: "Could not create booking — dates may already be taken." },
          { status: 409 },
        );
      }
    }

    if (!booking) {
      await rollback();
      return NextResponse.json({ error: "Could not create booking." }, { status: 500 });
    }
    created.push(booking);
  }

  const booking = created[0];

  // Manual bookings are inserted as Paid + Verified above (admin has
  // already handled payment and ID in person), so this is the same
  // "booking confirmed" email every other Paid booking gets — it's what
  // hands the guest their portal link. Only the primary booking's email
  // is sent: its portal page is where the guest lands and links to the
  // rest of the group, same as the public flow. Safe to call
  // unconditionally: it no-ops if the guest has no email on file.
  await sendPaymentSucceededEmail(supabase, booking.id, false);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const portalUrl = `${siteUrl}/portal/${booking.access_token}`;

  return NextResponse.json({
    ok: true,
    guestCard: {
      roomNames: [room.name, ...extraRooms.map((r) => r.name)],
      guestName: body.guestName.trim(),
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      bookingReference: booking.booking_reference,
      portalUrl,
      guestPhone: guestPhone || null,
      emailSent: Boolean(guestEmail),
    },
  });
}
