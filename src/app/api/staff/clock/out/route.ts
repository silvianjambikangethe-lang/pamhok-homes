import { NextResponse } from "next/server";
import { getStaffApiSession, getActiveWorkerId } from "@/lib/staff";

export async function POST() {
  const session = await getStaffApiSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  const { supabase } = session;
  const workerId = await getActiveWorkerId();

  if (!workerId) {
    return NextResponse.json({ error: "No active worker selected." }, { status: 400 });
  }

  // Through staff_clock_updates, scoped to the currently tapped worker's
  // own open shift (not just "any open shift") — the view itself doesn't
  // enforce per-worker ownership (there's no per-worker session to
  // scope by on a shared login), but this route's own filter keeps
  // "Clock Out" behaving as "clock myself out," not "clock out whoever."
  const { data, error } = await supabase
    .from("staff_clock_updates")
    .update({ clock_out_at: new Date().toISOString() })
    .eq("staff_member_id", workerId)
    .select("id");

  if (error) {
    return NextResponse.json({ error: "Could not clock out." }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "No open shift found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
