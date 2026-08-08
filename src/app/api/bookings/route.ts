import { NextResponse } from "next/server";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/data";
import { generateBookingReference, generatePassReference } from "@/lib/booking-reference";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

interface BookingRequestBody {
  roomId: string;
  checkIn: string;
  checkOut: string;
  guest: { fullName: string; email: string; phone: string };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+()\-\s]{7,20}$/;

function isValidBody(body: unknown): body is BookingRequestBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  if (typeof b.roomId !== "string" || typeof b.checkIn !== "string" || typeof b.checkOut !== "string") {
    return false;
  }
  const guest = b.guest as Record<string, unknown> | undefined;
  return (
    !!guest &&
    typeof guest.fullName === "string" &&
    guest.fullName.trim().length > 0 &&
    guest.fullName.trim().length <= 200 &&
    typeof guest.email === "string" &&
    EMAIL_RE.test(guest.email.trim()) &&
    typeof guest.phone === "string" &&
    PHONE_RE.test(guest.phone.trim())
  );
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        error:
          "The booking system isn't connected yet — please check back soon, or message us on WhatsApp to book directly.",
      },
      { status: 503 },
    );
  }

  const rateLimit = await checkRateLimit("booking", getClientIp(request), {
    maxAttempts: 5,
    windowMinutes: 10,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Too many booking attempts. Please try again in ${rateLimit.retryAfterMinutes} minute${rateLimit.retryAfterMinutes === 1 ? "" : "s"}.` },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!isValidBody(body)) {
    return NextResponse.json({ error: "Missing or invalid fields." }, { status: 400 });
  }

  const checkIn = parseISO(body.checkIn);
  const checkOut = parseISO(body.checkOut);
  const nights = differenceInCalendarDays(checkOut, checkIn);

  if (!Number.isFinite(nights) || nights < 1) {
    return NextResponse.json({ error: "Invalid date range." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", body.roomId)
    .eq("is_active", true)
    .maybeSingle();

  if (roomError || !room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }

  const { data: existing, error: availabilityError } = await supabase
    .from("availability_view")
    .select("*")
    .eq("room_id", body.roomId)
    .lt("check_in", body.checkOut)
    .gt("check_out", body.checkIn);

  if (availabilityError) {
    return NextResponse.json({ error: "Could not verify availability." }, { status: 500 });
  }

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: "Those dates were just booked. Please pick different dates." },
      { status: 409 },
    );
  }

  const { data: guestRow, error: guestError } = await supabase
    .from("guests")
    .insert({
      full_name: body.guest.fullName.trim(),
      email: body.guest.email.trim(),
      phone: body.guest.phone.trim(),
    })
    .select("id")
    .single();

  if (guestError || !guestRow) {
    return NextResponse.json({ error: "Could not save guest details." }, { status: 500 });
  }

  const totalAmount = nights * room.price_per_night;

  // booking_reference has a unique constraint — retry a few times on the
  // astronomically rare collision rather than failing the whole booking.
  let booking: { access_token: string; booking_reference: string | null } | null = null;
  for (let attempt = 0; attempt < 5 && !booking; attempt++) {
    const { data, error: bookingError } = await supabase
      .from("bookings")
      .insert({
        room_id: room.id,
        guest_id: guestRow.id,
        check_in: body.checkIn,
        check_out: body.checkOut,
        total_amount: totalAmount,
        currency: room.currency,
        payment_status: "Pending",
        booking_status: "Confirmed",
        booking_reference: generateBookingReference(),
        pass_reference: generatePassReference(body.checkIn, room.display_order),
      })
      .select("access_token, booking_reference")
      .single();

    if (data) {
      booking = data;
    } else if (bookingError?.code !== "23505") {
      return NextResponse.json({ error: "Could not create booking." }, { status: 500 });
    }
  }

  if (!booking) {
    return NextResponse.json({ error: "Could not create booking." }, { status: 500 });
  }

  return NextResponse.json({
    accessToken: booking.access_token,
    bookingReference: booking.booking_reference,
  });
}
