import { NextResponse } from "next/server";
import { isLaundryOpen } from "@/lib/stay-expiry";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { resolveRequestTarget } from "@/lib/portal-target";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const body = await request.json().catch(() => null);

  const supabase = createAdminSupabaseClient();

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("id, guest_id, check_in, check_out, booking_status, id_verification_status, checked_out_at")
    .eq("access_token", token)
    .maybeSingle();

  if (bookingError || !booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  // Same gating as the rest of the unlocked portal, plus the guide's
  // extra rule: laundry only during the active stay window, not before
  // check-in and not after checkout is confirmed.
  const isActiveStay = isLaundryOpen(booking);

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

  // A group booking's guest can file this for any of their other rooms (same
  // dates, so the stay-window check above covers it).
  const target = await resolveRequestTarget(supabase, booking, token, body?.targetToken);
  if (!target.ok) {
    return NextResponse.json({ error: target.error }, { status: target.status });
  }

  // The guest-facing form already hides "Request Pickup" while one is in
  // progress (see LaundrySection's hasActiveRequest/ACTIVE_STAGES), but
  // nothing enforced that server-side — a stale tab or a direct POST could
  // otherwise create a second, overlapping request that the guest's own
  // portal (which only ever shows the newest one) would then make
  // invisible to them, even though it's still live in the admin/staff
  // feeds. Mirrors LaundrySection's ACTIVE_STAGES exactly.
  const { data: activeExisting } = await supabase
    .from("guest_requests")
    .select("id")
    .eq("booking_id", target.bookingId)
    .eq("request_type", "laundry")
    .in("status", ["Open", "Picked Up", "Cleaning", "Ready", "Awaiting Payment"])
    .maybeSingle();

  if (activeExisting) {
    return NextResponse.json(
      { error: "You already have a laundry pickup in progress." },
      { status: 409 },
    );
  }

  const { error: insertError } = await supabase.from("guest_requests").insert({
    booking_id: target.bookingId,
    request_type: "laundry",
    message,
    status: "Open",
  });

  if (insertError) {
    return NextResponse.json({ error: "Could not send laundry request." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, forOtherRoom: target.forOtherRoom });
}
