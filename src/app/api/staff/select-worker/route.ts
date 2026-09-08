import { NextResponse } from "next/server";
import { getStaffApiSession, WORKER_COOKIE } from "@/lib/staff";

export async function POST(request: Request) {
  const session = await getStaffApiSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  const { supabase } = session;

  const body = await request.json().catch(() => null);
  const workerId = typeof body?.workerId === "string" ? body.workerId : "";

  if (!workerId) {
    return NextResponse.json({ error: "workerId is required." }, { status: 400 });
  }

  // Re-validated server-side against staff_members — never trust the
  // tapped id blindly, even though the tap screen only ever renders
  // active names to begin with.
  const { data: worker } = await supabase
    .from("staff_members")
    .select("id")
    .eq("id", workerId)
    .eq("active", true)
    .maybeSingle();

  if (!worker) {
    return NextResponse.json({ error: "That worker isn't available." }, { status: 404 });
  }

  const response = NextResponse.json({ ok: true });
  // Attribution/UX only, never an authorization boundary — the Supabase
  // session checked above is the real gate, so a site-wide path is fine
  // (path: "/staff" would look tighter but actually breaks this: cookie
  // paths are URL-prefix matched, and /api/staff/... does NOT start with
  // /staff, so every staff API route would silently never receive it).
  // httpOnly since there's no reason client JS needs to read it;
  // session-scoped (no maxAge) so it clears when the browser tab/session
  // ends, matching "tap in again next time you open the app" rather than
  // persisting indefinitely on a shared device.
  response.cookies.set(WORKER_COOKIE, workerId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return response;
}
