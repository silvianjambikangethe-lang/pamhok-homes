import { NextResponse } from "next/server";
import { getStaffApiSession, WORKER_COOKIE } from "@/lib/staff";

// Server-side (unlike AdminNav's client-only supabase.auth.signOut())
// because the tap-name cookie is httpOnly and can only be cleared here.
export async function POST() {
  const session = await getStaffApiSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  await session.supabase.auth.signOut();

  const response = NextResponse.json({ ok: true });
  response.cookies.delete(WORKER_COOKIE);
  // Also clear the pre-fix path="/staff" scoping (cookie deletion requires
  // an exact path match, so the default delete() above only clears the
  // current path="/" cookie) — harmless once every browser has picked up
  // the fix, but cheap insurance against a stuck stale cookie either way.
  response.cookies.set(WORKER_COOKIE, "", { path: "/staff", expires: new Date(0) });
  return response;
}
