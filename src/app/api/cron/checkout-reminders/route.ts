import { NextResponse } from "next/server";
import { addDays, format } from "date-fns";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// DORMANT: this endpoint computes which bookings need a checkout reminder,
// but the actual "send" step only logs — there's no email/SMS/WhatsApp
// provider wired up yet, and this project isn't deployed, so nothing can
// trigger this on a schedule either. Once both exist:
//   1. Point a scheduler at this URL (e.g. Vercel Cron, or a Supabase
//      Edge Function on a cron trigger) — twice daily, ~8 PM and ~9 AM,
//      matching the two reminder types below.
//   2. Replace `sendReminder`'s console.log with a real provider call
//      (e.g. Resend for email, Twilio/Africa's Talking for SMS).
//   3. Protect this route for real: compare a shared secret from the
//      scheduler against process.env.CRON_SECRET (already checked below).
//
// Until then, the *logic* here is real and correct — it's only the
// delivery mechanism that's missing.

type ReminderType = "evening-before" | "checkout-morning";

async function sendReminder(
  booking: { id: string; access_token: string; check_out: string },
  type: ReminderType,
) {
  // TODO: replace with a real notification provider once one is chosen.
  console.log(`[dormant] Would send "${type}" reminder for booking ${booking.id}`, {
    portalUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/portal/${booking.access_token}`,
    checkOut: booking.check_out,
  });
}

export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");

  const [{ data: eveningBefore }, { data: checkoutMorning }] = await Promise.all([
    // "Your stay wraps up tomorrow" — sent the evening before check_out.
    supabase
      .from("bookings")
      .select("id, access_token, check_out")
      .eq("check_out", tomorrow)
      .eq("booking_status", "Confirmed")
      .is("checked_out_at", null),
    // "Checkout is today" — sent the morning of check_out.
    supabase
      .from("bookings")
      .select("id, access_token, check_out")
      .eq("check_out", today)
      .eq("booking_status", "Confirmed")
      .is("checked_out_at", null),
  ]);

  await Promise.all([
    ...(eveningBefore ?? []).map((b) => sendReminder(b, "evening-before")),
    ...(checkoutMorning ?? []).map((b) => sendReminder(b, "checkout-morning")),
  ]);

  return NextResponse.json({
    ok: true,
    dormant: true,
    eveningBeforeCount: eveningBefore?.length ?? 0,
    checkoutMorningCount: checkoutMorning?.length ?? 0,
  });
}
