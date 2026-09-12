import { NextResponse } from "next/server";
import { getStaffApiSession, WORKER_COOKIE } from "@/lib/staff";
import { verifyPin, isValidPinFormat } from "@/lib/staff-pin";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// UUIDs are 36 chars — anything longer here is never a real staff_members
// id, so reject before it ever reaches a query.
const MAX_WORKER_ID_LENGTH = 36;

export async function POST(request: Request) {
  const session = await getStaffApiSession();
  if (!session) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const workerId = typeof body?.workerId === "string" ? body.workerId : "";
  const pin = typeof body?.pin === "string" ? body.pin : "";

  if (!workerId || workerId.length > MAX_WORKER_ID_LENGTH) {
    return NextResponse.json({ error: "workerId and pin are required." }, { status: 400 });
  }
  // Same format check the admin panel enforces when setting a PIN —
  // rejects an oversized or non-numeric value before it ever reaches
  // scryptSync (a bounded, cheap check either way, but no reason to spend
  // a scrypt hash on input that could never match a real PIN).
  if (!isValidPinFormat(pin)) {
    return NextResponse.json({ error: "Incorrect PIN." }, { status: 401 });
  }

  // A 4-digit PIN is only 10,000 combinations — rate-limited per worker
  // (not per IP: the whole point is this is a shared device) same as
  // every other login-style check in this app.
  const rateLimit = await checkRateLimit("staff-pin", workerId, {
    maxAttempts: 5,
    windowMinutes: 15,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${rateLimit.retryAfterMinutes} minute${rateLimit.retryAfterMinutes === 1 ? "" : "s"}.` },
      { status: 429 },
    );
  }

  // Re-validated server-side against staff_members — never trust the
  // tapped id blindly, even though the tap screen only ever renders
  // active names to begin with.
  //
  // Service-role client deliberately, not the RLS-bound session client:
  // pin_hash's SELECT grant was revoked from authenticated/anon entirely
  // (2026-09-12 fix — any staff session could otherwise read every
  // worker's pin_hash straight through the public REST API and crack it
  // offline, completely bypassing this route's rate limit). This is a
  // server-only route and the hash never leaves this function, so
  // reading it via service-role here is safe.
  const adminClient = createAdminSupabaseClient();
  const { data: worker } = await adminClient
    .from("staff_members")
    .select("id, pin_hash")
    .eq("id", workerId)
    .eq("active", true)
    .maybeSingle();

  if (!worker) {
    return NextResponse.json({ error: "That worker isn't available." }, { status: 404 });
  }

  if (!worker.pin_hash) {
    return NextResponse.json(
      { error: "No PIN set for this profile yet — ask the host to set one from Settings." },
      { status: 409 },
    );
  }

  if (!verifyPin(pin, worker.pin_hash)) {
    return NextResponse.json({ error: "Incorrect PIN." }, { status: 401 });
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
