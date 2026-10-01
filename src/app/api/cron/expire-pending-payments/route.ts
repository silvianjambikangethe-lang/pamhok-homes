import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  expireStaleBookingPaymentsBatch,
  expireStaleLaundryPaymentsBatch,
} from "@/lib/pending-payment-expiry";

// Backstop only, same reasoning as expire-extension-holds — the real
// enforcement is lazy (expireStaleBookingPayment/expireStaleLaundryPayment
// run on every portal booking read, see getBookingByToken in
// src/lib/portal.ts), because Vercel's cron on this project's current plan
// can only run once a day and can't reliably catch an abandoned Jenga
// checkout (closed tab, Jenga's own page errors before the guest submits,
// etc.) on its own. This exists only to eventually clean up a booking
// nobody happens to reload. Same auth pattern as the other cron routes, see
// checkout-reminders for details.

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

  const expiredBookings = await expireStaleBookingPaymentsBatch(supabase, pendingBookings ?? [], now);

  const { data: pendingLaundry } = await supabase
    .from("guest_requests")
    .select("id, laundry_payment_status, created_at")
    .eq("request_type", "laundry")
    .eq("laundry_payment_status", "Pending");

  const expiredLaundry = await expireStaleLaundryPaymentsBatch(supabase, pendingLaundry ?? [], now);

  return NextResponse.json({
    ok: true,
    checkedBookings: pendingBookings?.length ?? 0,
    expiredBookings,
    checkedLaundry: pendingLaundry?.length ?? 0,
    expiredLaundry,
  });
}
