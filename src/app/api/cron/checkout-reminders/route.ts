import { NextResponse } from "next/server";
import { format } from "date-fns";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { sendEmail, checkoutReminderEmail } from "@/lib/email";

// Sends ONE reminder per stay, on the check-out day only: vercel.json runs
// this at 05:00 UTC = 08:00 Nairobi, two hours before the 10:00 AM check-out.
// There is deliberately no day-before email (and so no "extend your stay"
// nudge); guests who want more nights can still extend from their booking
// page. Vercel Cron authenticates its own requests with
// `Authorization: Bearer $CRON_SECRET` when a CRON_SECRET env var exists;
// this also accepts a manual `x-cron-secret` header for any other caller.

interface ReminderBooking {
  id: string;
  access_token: string;
  check_out: string;
  guest: { full_name: string; email: string | null } | null;
  room: { name: string } | null;
}

async function sendReminder(booking: ReminderBooking) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const portalUrl = `${siteUrl}/portal/${booking.access_token}`;

  if (!booking.guest?.email) return;

  const { subject, html } = checkoutReminderEmail({
    guestName: booking.guest.full_name,
    roomName: booking.room?.name ?? "your room",
    portalUrl,
  });
  await sendEmail({ to: booking.guest.email, subject, html });
}

function isAuthorized(request: Request): boolean {
  // Fail closed, not open: a missing CRON_SECRET must never mean "let
  // anyone in" (an accidentally-unset/misconfigured env var used to make
  // this route callable by the entire public internet with no auth at
  // all — 2026-09-12 fix).
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
  // 05:00 UTC is already the same calendar day in Nairobi (08:00), so the UTC
  // date is the check-out date.
  const today = format(new Date(), "yyyy-MM-dd");

  const { data } = await supabase
    .from("bookings")
    .select("id, access_token, check_out, guest:guests(full_name, email), room:rooms(name)")
    .eq("check_out", today)
    .eq("booking_status", "Confirmed")
    .eq("payment_status", "Paid")
    .is("checked_out_at", null);

  const dueToday = (data ?? []) as unknown as ReminderBooking[];
  await Promise.all(dueToday.map((b) => sendReminder(b)));

  return NextResponse.json({ ok: true, checkoutTodayCount: dueToday.length });
}
