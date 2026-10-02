import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { releaseExpiredExtensionHold } from "@/lib/extension-hold";

// Backstop only — the real enforcement of the 10-minute extension-hold
// window is availability_view's own live time check (so a room frees up
// for other guests the moment the window passes, independent of this
// cron or any page load) plus releaseExpiredExtensionHold running on
// every booking read (portal page, verify page, extend/check,
// extend/confirm), which cleans up the stale pending_extension_* fields
// on the booking row itself. Vercel's cron on this project's current plan
// can only run once a day, so this route is only a backstop for a
// booking nobody ever reloads. Same auth pattern as the other cron
// routes — see checkout-reminders for details.

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

  const { data: pending } = await supabase
    .from("bookings")
    .select(
      "id, payment_status, total_amount, pending_extension_check_out, pending_extension_amount, pending_extension_requested_at",
    )
    .not("pending_extension_check_out", "is", null)
    .eq("payment_status", "Pending");

  const bookings = pending ?? [];
  let releasedCount = 0;
  for (const booking of bookings) {
    if (await releaseExpiredExtensionHold(supabase, booking)) releasedCount++;
  }

  return NextResponse.json({ ok: true, checked: bookings.length, releasedCount });
}
