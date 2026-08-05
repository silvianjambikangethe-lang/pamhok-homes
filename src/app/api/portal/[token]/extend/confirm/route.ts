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
    .select(
      "id, room_id, check_out, total_amount, id_verification_status, checked_out_at, room:rooms(price_per_night)",
    )
    .eq("access_token", token)
    .maybeSingle();

  if (error || !booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  if (booking.id_verification_status !== "Verified" || booking.checked_out_at || !booking.room_id) {
    return NextResponse.json({ error: "Extension isn't available for this booking." }, { status: 403 });
  }

  const newCheckOut = format(addDays(new Date(booking.check_out), additionalNights), "yyyy-MM-dd");

  // Re-validate at confirm time too — the availability check a moment ago
  // doesn't hold a lock, so someone else could have booked in between.
  const { data: conflicts, error: availError } = await supabase
    .from("availability_view")
    .select("check_in")
    .eq("room_id", booking.room_id)
    .lt("check_in", newCheckOut)
    .gt("check_out", booking.check_out);

  if (availError) {
    return NextResponse.json({ error: "Could not verify availability." }, { status: 500 });
  }
  if (conflicts && conflicts.length > 0) {
    return NextResponse.json(
      { error: "Those extra nights were just booked. Please try fewer nights." },
      { status: 409 },
    );
  }

  const room = (booking as unknown as { room?: { price_per_night?: number } }).room;
  const additionalCost = additionalNights * (room?.price_per_night ?? 0);

  // Simplification, documented: extending re-opens payment for the whole
  // updated total rather than tracking the original charge and the
  // extension as separate line items. A booking that was already fully
  // paid will show as Pending again until the guest pays the difference —
  // itemized/partial payment tracking would need a schema change this
  // brief didn't ask for.
  const { error: updateError } = await supabase
    .from("bookings")
    .update({
      check_out: newCheckOut,
      total_amount: booking.total_amount + additionalCost,
      payment_status: "Pending",
      payment_method: null,
      paid_at: null,
    })
    .eq("id", booking.id);

  if (updateError) {
    return NextResponse.json({ error: "Could not extend your stay." }, { status: 500 });
  }

  // Extension has no other guest-facing record of its own — write it into
  // guest_requests so it shows up in the same admin feed (and Overview's
  // open-requests badge) as laundry/assistance requests.
  await supabase.from("guest_requests").insert({
    booking_id: booking.id,
    request_type: "extension",
    message: `Requested ${additionalNights} extra night${additionalNights === 1 ? "" : "s"} — additional ${new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(additionalCost)}.`,
    status: "Open",
  });

  return NextResponse.json({ ok: true, newCheckOut });
}
