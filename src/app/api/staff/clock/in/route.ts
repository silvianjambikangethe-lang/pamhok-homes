import { NextResponse } from "next/server";
import { getStaffApiSession, getActiveWorkerId } from "@/lib/staff";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST() {
  const session = await getStaffApiSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  const workerId = await getActiveWorkerId();

  if (!workerId) {
    return NextResponse.json({ error: "No active worker selected." }, { status: 400 });
  }

  // Service-role: staff has no direct RLS policy on shift_logs at all —
  // every staff write goes through this route or staff_clock_updates.
  const adminClient = createAdminSupabaseClient();
  const { error } = await adminClient
    .from("shift_logs")
    .insert({ staff_member_id: workerId });

  if (error) {
    // 23505 = shift_logs_one_open_per_worker — this worker already has
    // an open shift (e.g. a second device, or a double-tap).
    if (error.code === "23505") {
      return NextResponse.json({ error: "Already clocked in." }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not clock in." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
