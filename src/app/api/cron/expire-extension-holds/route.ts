import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { releaseExpiredExtensionHold } from "@/lib/extension-hold";

// Backstop only — the real enforcement of the 3-hour extension-hold
// window is lazy (releaseExpiredExtensionHold runs on every booking read:
// portal page, verify page, extend/check, extend/confirm), because
// Vercel's cron on this project's current plan can only run once a day
// and can't reliably enforce a 3-hour SLA on its own. This exists only to
// eventually clean up a booking nobody happens to reload. Same auth
// pattern as the other cron routes — see checkout-reminders for details.

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
