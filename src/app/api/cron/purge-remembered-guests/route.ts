import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { REMEMBERED_GUEST_RETENTION_DAYS } from "@/lib/guest-recognition";

// Data minimization for the "Remember Me" feature: a remembered guest who
// hasn't opted in again (at checkout) or signed in with an emailed code for
// two years has their saved name, email and phone removed. Also sweeps any
// expired one-time codes as a backstop. Same auth pattern as the other cron
// routes, see checkout-reminders for details.

function isAuthorized(request: Request): boolean {
  // Fail closed, not open.
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
  const cutoff = new Date(
    Date.now() - REMEMBERED_GUEST_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: removed } = await supabase
    .from("remembered_guests")
    .delete()
    .lt("updated_at", cutoff)
    .select("email");

  await supabase
    .from("guest_recognition_codes")
    .delete()
    .lt("expires_at", new Date().toISOString());

  return NextResponse.json({ ok: true, removedGuests: removed?.length ?? 0 });
}
