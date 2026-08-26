import { NextResponse } from "next/server";
import { format } from "date-fns";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getCleaningNotices } from "@/lib/guest-notices";
import { sendEmail, cleaningNoticeEmail } from "@/lib/email";

// Point a scheduler at this route once daily, mid-morning (see
// vercel.json's `crons` entry). Reuses the exact day-math from
// getCleaningNotices() (src/lib/guest-notices.ts) that already drives the
// in-portal notice on the My Booking page, so the two can't drift.
// Same auth pattern as checkout-reminders — see that file for details.

interface ActiveBooking {
  id: string;
  access_token: string;
  check_in: string;
  check_out: string;
  guest: { full_name: string; email: string | null } | null;
  room: { name: string } | null;
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

  const { data } = await supabase
    .from("bookings")
    .select(
      "id, access_token, check_in, check_out, guest:guests(full_name, email), room:rooms(name)",
    )
    .eq("booking_status", "Confirmed")
    .eq("payment_status", "Paid")
    .is("checked_out_at", null)
    .lte("check_in", today)
    .gt("check_out", today);

  const activeBookings = (data ?? []) as unknown as ActiveBooking[];
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const due = activeBookings.filter(
    (b) => getCleaningNotices(b.check_in, b.check_out).length > 0 && b.guest?.email,
  );

  await Promise.all(
    due.map((b) => {
      const { subject, html } = cleaningNoticeEmail({
        guestName: b.guest!.full_name,
        roomName: b.room?.name ?? "your room",
        portalUrl: `${siteUrl}/portal/${b.access_token}`,
      });
      return sendEmail({ to: b.guest!.email!, subject, html });
    }),
  );

  return NextResponse.json({ ok: true, sentCount: due.length });
}
