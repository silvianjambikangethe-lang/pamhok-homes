import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getStaffApiSession } from "@/lib/staff";

// Staff counterpart of /api/admin/pulse, mounted once in the staff layout so
// every staff page (cleaning, laundry, overview, schedule) updates itself when
// a guest sends a request or a stay changes. Staff only ever see the
// staff_* views, so the fingerprint is built from those and nothing else.
export async function GET() {
  const session = await getStaffApiSession();
  if (!session) return NextResponse.json({ error: "Not authorized." }, { status: 401 });

  const [feed, schedule] = await Promise.all([
    session.supabase
      .from("staff_cleaning_laundry_feed")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500),
    session.supabase.from("staff_checkout_schedule").select("*").limit(500),
  ]);

  if (feed.error || schedule.error) {
    return NextResponse.json({ error: "Could not load status." }, { status: 500 });
  }

  const fingerprint = createHash("sha1")
    .update(JSON.stringify([feed.data, schedule.data]))
    .digest("hex");
  return NextResponse.json({ fingerprint });
}
