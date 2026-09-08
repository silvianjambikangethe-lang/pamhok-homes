import { NextResponse } from "next/server";
import { getStaffApiSession, WORKER_COOKIE } from "@/lib/staff";

// Clears the tap-name cookie without signing out of the shared login —
// for handing the device to a different worker mid-shift without
// re-entering the shared credentials.
export async function POST() {
  const session = await getStaffApiSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(WORKER_COOKIE);
  // See the matching comment in /api/staff/logout — clears a pre-fix
  // path="/staff"-scoped cookie the default delete() above can't reach.
  response.cookies.set(WORKER_COOKIE, "", { path: "/staff", expires: new Date(0) });
  return response;
}
