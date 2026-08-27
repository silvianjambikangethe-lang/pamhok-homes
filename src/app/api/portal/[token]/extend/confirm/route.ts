import { NextResponse } from "next/server";
import { addDays, format } from "date-fns";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { releaseExpiredExtensionHold } from "@/lib/extension-hold";

const SELECT =
  "id, room_id, check_out, total_amount, payment_status, id_verification_status, checked_out_at, pending_extension_check_out, pending_extension_amount, pending_extension_requested_at, room:rooms(price_per_night)";

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

  // Only a guest whose current stay is already fully paid can request more
  // nights — this is what makes "extending" mean something concrete rather
  // than letting an unpaid booking's balance grow indefinitely.
  if (booking.payment_status !== "Paid") {
    return NextResponse.json(
      { error: "Your current stay needs to be fully paid before you can request more nights." },
      { status: 403 },
    );
  }

  if (booking.pending_extension_check_out) {
    return NextResponse.json(
      { error: "You already have an extension awaiting payment — complete that payment before requesting more nights." },
      { status: 409 },
    );
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

  // check_out is deliberately NOT updated here — the extra nights are only
  // granted once payment for them is confirmed (see the payment-completion
  // paths: PayPal capture, admin mark-paid, and the mpesa-callback edge
  // function, which all call resolvePendingExtensionAfterPayment when they
  // flip payment_status to Paid). Until then this is a real hold, not just
  // a note: availability_view treats pending_extension_check_out as
  // occupied for up to EXTENSION_HOLD_HOURS from
  // pending_extension_requested_at, so nobody else can book those dates
  // out from under this guest while they arrange payment — and the hold
  // releases itself (see releaseExpiredExtensionHold) once that window
  // passes without payment.
  //
  // Simplification, documented: extending re-opens payment for the whole
  // updated total rather than tracking the original charge and the
  // extension as separate line items — itemized/partial payment tracking
  // would need a bigger schema change than this brief asked for.
  // `paid_at`/`payment_method` are left untouched: they're the guest's
  // proof they were already an active, verified guest before this
  // extension, which the portal UI uses to keep the door
  // code/WiFi/laundry/checkout visible while the extra nights are still
  // Pending — a guest already staying here shouldn't lose access to their
  // own room over an unpaid top-up.
  const { error: updateError } = await supabase
    .from("bookings")
    .update({
      total_amount: booking.total_amount + additionalCost,
      payment_status: "Pending",
      pending_extension_check_out: newCheckOut,
      pending_extension_nights: additionalNights,
      pending_extension_amount: additionalCost,
      pending_extension_requested_at: new Date().toISOString(),
    })
    .eq("id", booking.id);

  if (updateError) {
    return NextResponse.json({ error: "Could not request your extension." }, { status: 500 });
  }

  // Extension has no other guest-facing record of its own — write it into
  // guest_requests so it shows up in the same admin feed (and Overview's
  // open-requests badge) as laundry/assistance requests.
  await supabase.from("guest_requests").insert({
    booking_id: booking.id,
    request_type: "extension",
    message: `Requested ${additionalNights} extra night${additionalNights === 1 ? "" : "s"} (new check-out ${newCheckOut}) — additional ${new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(additionalCost)}, awaiting payment.`,
    status: "Open",
  });

  return NextResponse.json({ ok: true, pendingCheckOut: newCheckOut });
}
