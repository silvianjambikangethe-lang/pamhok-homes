import { NextResponse } from "next/server";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/data";
import { generateBookingReference, generatePassReference } from "@/lib/booking-reference";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { isNameBlocked } from "@/lib/guest-blocklist";
import { SITE } from "@/lib/site";
import { EMAIL_RE, PHONE_RE } from "@/lib/validation";

// One response for anything that stops a booking being created on our side,
// including a name on the host's blocked list. A real hiccup and a blocked
// name look exactly the same to the visitor (same words, same status), so the
// list can't be discovered by trying names, and nobody is told they were
// singled out. It points to a phone call so a genuine mix-up can be sorted out.
function cannotCompleteOnline() {
  return NextResponse.json(
    {
      error: `We couldn't complete this booking online right now. Please call us on ${SITE.phone} and we'll help you book.`,
    },
    { status: 503 },
  );
}

interface BookingRequestBody {
  roomId: string;
  // A group of more than 2 books several rooms for the same dates under one
  // guest record. Each extra room becomes its own booking (own portal, own
  // payment), all sharing the guest and the dates.
  extraRoomIds?: string[];
  checkIn: string;
  checkOut: string;
  guest: { fullName: string; email: string; phone: string };
}

const MAX_EXTRA_ROOMS = 9;

function isValidBody(body: unknown): body is BookingRequestBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  if (typeof b.roomId !== "string" || typeof b.checkIn !== "string" || typeof b.checkOut !== "string") {
    return false;
  }
  if (typeof b.extraRoomIds !== "undefined") {
    const extras = b.extraRoomIds;
    if (
      !Array.isArray(extras) ||
      extras.length > MAX_EXTRA_ROOMS ||
      !extras.every((id) => typeof id === "string" && id.length > 0 && id.length <= 64) ||
      new Set(extras).size !== extras.length ||
      extras.includes(b.roomId)
    ) {
      return false;
    }
  }
  const guest = b.guest as Record<string, unknown> | undefined;
  return (
    !!guest &&
    typeof guest.fullName === "string" &&
    guest.fullName.trim().length > 0 &&
    guest.fullName.trim().length <= 100 &&
    typeof guest.email === "string" &&
    guest.email.trim().length <= 254 &&
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

  // Extra rooms (group booking): every one must exist, be active and be free
  // for the same dates — checked before any guest/booking row is written.
  const extraRoomIds = body.extraRoomIds ?? [];
  let extraRooms: (typeof room)[] = [];
  if (extraRoomIds.length > 0) {
    const { data: extras, error: extrasError } = await supabase
      .from("rooms")
      .select("*")
      .in("id", extraRoomIds)
      .eq("is_active", true);

    if (extrasError || !extras || extras.length !== extraRoomIds.length) {
      return NextResponse.json(
        { error: "One of the rooms you picked is no longer available." },
        { status: 404 },
      );
    }

    const { data: extrasTaken, error: extrasAvailabilityError } = await supabase
      .from("availability_view")
      .select("room_id")
      .in("room_id", extraRoomIds)
      .lt("check_in", body.checkOut)
      .gt("check_out", body.checkIn);

    if (extrasAvailabilityError) {
      return NextResponse.json({ error: "Could not verify availability." }, { status: 500 });
    }
    if (extrasTaken && extrasTaken.length > 0) {
      return NextResponse.json(
        { error: "One of those rooms was just booked. Please pick again." },
        { status: 409 },
      );
    }

    // Keep the order the guest picked them in.
    extraRooms = extraRoomIds.map((id) => extras.find((r) => r.id === id)!);
  }

  // Blocklist gate. Runs after every check the visitor could fix themselves
  // (fields, dates, room, availability) and before any guest or booking row
  // exists, so a blocked name never gets as far as a reservation. It answers
  // exactly like any other server-side failure (see cannotCompleteOnline).
  if (await isNameBlocked(supabase, body.guest.fullName)) {
    return cannotCompleteOnline();
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
    return cannotCompleteOnline();
  }

  const guestId = guestRow.id;
  const created: { id: string; access_token: string; booking_reference: string | null }[] = [];

  // A group booking is all-or-nothing: if any room fails, remove whatever
  // was already created for this request so no half-booked group is left.
  async function rollback() {
    if (created.length > 0) {
      await supabase.from("bookings").delete().in("id", created.map((b) => b.id));
    }
    await supabase.from("guests").delete().eq("id", guestId);
  }

  // The requested room first, so its portal is where the guest lands; the
  // portal then links to the others (same guest, same dates).
  for (const bookedRoom of [room, ...extraRooms]) {
    const totalAmount = nights * bookedRoom.price_per_night;

    // booking_reference has a unique constraint — retry a few times on the
    // astronomically rare collision rather than failing the whole booking.
    let booking: { id: string; access_token: string; booking_reference: string | null } | null =
      null;
    for (let attempt = 0; attempt < 5 && !booking; attempt++) {
      const { data, error: bookingError } = await supabase
        .from("bookings")
        .insert({
          room_id: bookedRoom.id,
          guest_id: guestId,
          check_in: body.checkIn,
          check_out: body.checkOut,
          total_amount: totalAmount,
          currency: bookedRoom.currency,
          payment_status: "Pending",
          booking_status: "Confirmed",
          booking_reference: generateBookingReference(),
          pass_reference: generatePassReference(body.checkIn, bookedRoom.display_order),
        })
        .select("id, access_token, booking_reference")
        .single();

      if (data) {
        booking = data;
      } else if (bookingError?.code !== "23505") {
        await rollback();
        return cannotCompleteOnline();
      }
    }

    if (!booking) {
      await rollback();
      return cannotCompleteOnline();
    }
    created.push(booking);
  }

  const booking = created[0];

  // No confirmation email here on purpose — "Booking Confirmation" is sent
  // when payment_status actually becomes 'Paid' (see
  // src/lib/booking-emails.ts), not at request-submission time, since a
  // booking created here is still just a hold until it's paid for.
  return NextResponse.json({
    accessToken: booking.access_token,
    bookingReference: booking.booking_reference,
    roomCount: created.length,
  });
}
