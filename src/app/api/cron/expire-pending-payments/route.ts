import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { expireStaleBookingPayment, expireStaleLaundryPayment } from "@/lib/pending-payment-expiry";

// Backstop for a guest who opens Jenga's hosted checkout and never finishes
// (closed tab, Jenga's own page errors before they submit, etc.) — Jenga
// then never calls back, so the booking/laundry charge is stuck at
// payment_status "Pending" with nothing to resolve it. The 15-minute date
// hold already releases the room on its own (payment_window_hold
// migration); this only cleans up the stale row. Runs once a day on this
// project's current Vercel plan — same auth pattern as the other cron
// routes, see checkout-reminders for details.

function isAuthorized(request: Request): boolean {
  // Fail closed, not open — see checkout-reminders for why (2026-09-12).
  if (!process.env.CRON_SECRET) return false;
  const bearer = request.headers.get("authorization");
  if (bearer === `Bearer ${process.env.CRON_SECRET}`) return true;
  return request.headers.get("x-cron-secret") === process.env.CRON_SECRET;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const now = new Date();

  const { data: pendingBookings } = await supabase
    .from("bookings")
    .select("id, payment_status, paid_at, created_at")
    .eq("payment_status", "Pending");

  let expiredBookings = 0;
  for (const booking of pendingBookings ?? []) {
    if (await expireStaleBookingPayment(supabase, booking, now)) expiredBookings++;
  }

  const { data: pendingLaundry } = await supabase
    .from("guest_requests")
    .select("id, laundry_payment_status, created_at")
    .eq("request_type", "laundry")
    .eq("laundry_payment_status", "Pending");

  let expiredLaundry = 0;
  for (const request_ of pendingLaundry ?? []) {
    if (await expireStaleLaundryPayment(supabase, request_, now)) expiredLaundry++;
  }

  return NextResponse.json({
    ok: true,
    checkedBookings: pendingBookings?.length ?? 0,
    expiredBookings,
    checkedLaundry: pendingLaundry?.length ?? 0,
    expiredLaundry,
  });
}
