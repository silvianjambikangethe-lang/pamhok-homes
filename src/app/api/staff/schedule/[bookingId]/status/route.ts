import { NextResponse } from "next/server";
import { addDays, format } from "date-fns";
import { getStaffApiSession, getActiveWorkerId } from "@/lib/staff";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { GuestRequestStatus } from "@/lib/supabase/types";

const ALLOWED_STATUS: readonly GuestRequestStatus[] = ["Open", "In Progress", "Resolved"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const { bookingId } = await params;
  const session = await getStaffApiSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  const workerId = await getActiveWorkerId();

  if (!workerId) {
    return NextResponse.json({ error: "No active worker selected." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const status = body?.status;

  if (typeof status !== "string" || !ALLOWED_STATUS.includes(status as GuestRequestStatus)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  // Service-role, not the staff_checkout_schedule view: this needs to
  // both read bookings (to re-validate eligibility — never trust the
  // client-supplied bookingId blindly) and write guest_requests, neither
  // of which a staff session has any RLS path to directly.
  const adminClient = createAdminSupabaseClient();

  const today = format(new Date(), "yyyy-MM-dd");
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");

  const { data: booking } = await adminClient
    .from("bookings")
    .select("id, check_out, checked_out_at, booking_status")
    .eq("id", bookingId)
    .maybeSingle();

  const eligible =
    booking &&
    booking.checked_out_at === null &&
    ["Confirmed", "Pending Verification"].includes(booking.booking_status) &&
    (booking.check_out === today || booking.check_out === tomorrow);

  if (!eligible) {
    return NextResponse.json({ error: "Not an eligible checkout." }, { status: 404 });
  }

  const { error: insertError } = await adminClient.from("guest_requests").insert({
    booking_id: bookingId,
    request_type: "cleaning",
    message: "Checkout cleaning",
    status: status as GuestRequestStatus,
    is_turnover: true,
    completed_by: workerId,
  });

  if (!insertError) {
    return NextResponse.json({ ok: true });
  }

  // 23505 = unique_violation on guest_requests_turnover_unique — another
  // device already created this checkout's turnover row (possibly
  // moments ago); fall through to updating that existing row instead of
  // erroring, so two staff tapping "Start" near-simultaneously both
  // succeed against the same row.
  if (insertError.code !== "23505") {
    return NextResponse.json({ error: "Could not update schedule." }, { status: 500 });
  }

  const { error: updateError } = await adminClient
    .from("guest_requests")
    .update({ status: status as GuestRequestStatus, completed_by: workerId })
    .eq("booking_id", bookingId)
    .eq("request_type", "cleaning")
    .eq("is_turnover", true);

  if (updateError) {
    return NextResponse.json({ error: "Could not update schedule." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
