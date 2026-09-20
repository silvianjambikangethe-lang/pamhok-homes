import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { completeCheckout } from "@/lib/checkout";

// Admin-side equivalent of the guest tapping "Check out" in their portal,
// for guests who leave without doing it. Runs the same completeCheckout()
// (ID photo + phone wipe, review-link email), so it needs the service-role
// client — but only after confirming the caller really is an admin, since
// service-role bypasses every RLS check.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const authClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authorized." }, { status: 401 });

  const { data: adminRow } = await authClient
    .from("admin_users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!adminRow) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  const supabase = createAdminSupabaseClient();

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, booking_status")
    .eq("id", id)
    .maybeSingle();

  if (!booking) {
    return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  }

  // A Blocked date range or a Cancelled/unverified booking isn't a guest
  // occupying a room, so there's nothing to check out.
  if (booking.booking_status !== "Confirmed") {
    return NextResponse.json(
      { error: "Only a confirmed stay can be marked as checked out." },
      { status: 409 },
    );
  }

  const result = await completeCheckout(supabase, { bookingId: id });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
