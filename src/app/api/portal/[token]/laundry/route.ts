import { NextResponse } from "next/server";
import { startOfDay } from "date-fns";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const body = await request.json().catch(() => null);

  const supabase = createAdminSupabaseClient();

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, check_in, check_out, booking_status, id_verification_status, checked_out_at")
    .eq("access_token", token)
    .maybeSingle();

  if (bookingError || !booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  // Same gating as the rest of the unlocked portal, plus the guide's
  // extra rule: laundry only during the active stay window, not before
  // check-in and not after checkout is confirmed.
  const today = startOfDay(new Date());
  const checkIn = startOfDay(new Date(booking.check_in));
  const checkOut = startOfDay(new Date(booking.check_out));
  const isActiveStay = today >= checkIn && today < checkOut;

  if (
    booking.booking_status !== "Confirmed" ||
    booking.id_verification_status !== "Verified" ||
    booking.checked_out_at ||
    !isActiveStay
  ) {
    return NextResponse.json(
      { error: "Laundry pickup is only available during your stay." },
      { status: 403 },
    );
  }

  const itemCount = typeof body?.itemCount === "string" ? body.itemCount.slice(0, 50) : "";
  const notes = typeof body?.notes === "string" ? body.notes.slice(0, 500) : "";
  const message = [itemCount && `Items: ${itemCount}`, notes && `Notes: ${notes}`]
    .filter(Boolean)
    .join("\n") || null;

  const { error: insertError } = await supabase.from("guest_requests").insert({
    booking_id: booking.id,
    request_type: "laundry",
    message,
    status: "Open",
  });

  if (insertError) {
    return NextResponse.json({ error: "Could not send laundry request." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
