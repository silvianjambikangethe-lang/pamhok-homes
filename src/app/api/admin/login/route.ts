import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// Real server-side brute-force protection — the login page's obscurity
// (a quiet footer link, not the nav) is just a UX convenience, not
// security on its own. This is the actual gate: 8 wrong passwords for a
// given email locks that email out for 15 minutes, checked here before
// Supabase Auth is even called. Keyed by email (not IP) since there's
// only ever one real admin account — this stops password-guessing
// against that one account, which is the actual threat model here.
const MAX_ATTEMPTS = 8;
const LOCKOUT_MINUTES = 15;

function lockoutMessage(lockedUntil: string) {
  const minutesLeft = Math.max(1, Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 60000));
  return `Too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.`;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const adminClient = createAdminSupabaseClient();

  const { data: attempt } = await adminClient
    .from("login_attempts")
    .select("attempt_count, locked_until")
    .eq("email", email)
    .maybeSingle();

  if (attempt?.locked_until && new Date(attempt.locked_until) > new Date()) {
    return NextResponse.json({ error: lockoutMessage(attempt.locked_until) }, { status: 429 });
  }

  const supabase = await createServerSupabaseClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

  if (signInError) {
    const nextCount = (attempt?.attempt_count ?? 0) + 1;
    const justLocked = nextCount >= MAX_ATTEMPTS;
    const lockedUntil = justLocked
      ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString()
      : null;

    await adminClient.from("login_attempts").upsert({
      email,
      attempt_count: justLocked ? 0 : nextCount,
      locked_until: lockedUntil,
      last_attempt_at: new Date().toISOString(),
    });

    return NextResponse.json(
      { error: justLocked ? lockoutMessage(lockedUntil!) : "Incorrect email or password." },
      { status: justLocked ? 429 : 401 },
    );
  }

  // Successful login clears any history for this email.
  await adminClient.from("login_attempts").delete().eq("email", email);

  return NextResponse.json({ ok: true });
}
