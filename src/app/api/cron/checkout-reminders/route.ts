import { NextResponse } from "next/server";
import { addDays, format } from "date-fns";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { sendEmail, checkoutReminderEmail } from "@/lib/email";

// Point a scheduler at this route once or twice daily (see vercel.json's
// `crons` entry) — ~8 PM for "evening-before", ~9 AM for
// "checkout-morning". Vercel Cron authenticates its own requests with
// `Authorization: Bearer $CRON_SECRET` when a CRON_SECRET env var exists;
// this also accepts a manual `x-cron-secret` header for any other caller.

type ReminderType = "evening-before" | "checkout-morning";

interface ReminderBooking {
  id: string;
  access_token: string;
  check_out: string;
  guest: { full_name: string; email: string | null } | null;
  room: { name: string } | null;
}

async function sendReminder(booking: ReminderBooking, type: ReminderType) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const portalUrl = `${siteUrl}/portal/${booking.access_token}`;

  if (!booking.guest?.email) return;

  const { subject, html } = checkoutReminderEmail({
    guestName: booking.guest.full_name,
    roomName: booking.room?.name ?? "your room",
    type,
    portalUrl,
  });
  await sendEmail({ to: booking.guest.email, subject, html });
}

function isAuthorized(request: Request): boolean {
  if (!process.env.CRON_SECRET) return true;
  const bearer = request.headers.get("authorization");
  if (bearer === `Bearer ${process.env.CRON_SECRET}`) return true;
  return request.headers.get("x-cron-secret") === process.env.CRON_SECRET;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");

  const selectWithJoins =
    "id, access_token, check_out, guest:guests(full_name, email), room:rooms(name)";

  const [{ data: eveningBefore }, { data: checkoutMorning }] = await Promise.all([
    // "Your stay wraps up tomorrow" — sent the evening before check_out.
    supabase
      .from("bookings")
      .select(selectWithJoins)
      .eq("check_out", tomorrow)
      .eq("booking_status", "Confirmed")
      .is("checked_out_at", null),
    // "Checkout is today" — sent the morning of check_out.
    supabase
      .from("bookings")
      .select(selectWithJoins)
      .eq("check_out", today)
      .eq("booking_status", "Confirmed")
      .is("checked_out_at", null),
  ]);

  const evening = (eveningBefore ?? []) as unknown as ReminderBooking[];
  const morning = (checkoutMorning ?? []) as unknown as ReminderBooking[];

  await Promise.all([
    ...evening.map((b) => sendReminder(b, "evening-before")),
    ...morning.map((b) => sendReminder(b, "checkout-morning")),
  ]);

  return NextResponse.json({
    ok: true,
    eveningBeforeCount: evening.length,
    checkoutMorningCount: morning.length,
  });
}
