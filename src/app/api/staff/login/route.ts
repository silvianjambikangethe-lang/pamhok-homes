import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// Mirrors /api/admin/login's brute-force lockout exactly (same
// login_attempts table, keyed by email — this is a distinct email from
// the admin account, so no schema change was needed to share the
// mechanism). Same 3-attempt/15-minute lockout, same reasoning: the
// login page's obscurity is a UX convenience, not the actual security
// boundary.
const MAX_ATTEMPTS = 3;
const LOCKOUT_MINUTES = 15;

function lockoutMessage(lockedUntil: string) {
  const minutesLeft = Math.max(1, Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 60000));
  return `Too many failed attempts. Try again in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.`;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password || email.length > 254 || password.length > 128) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const adminClient = createAdminSupabaseClient();

  const { data: attempt } = await adminClient
    .from("login_attempts")
    .select("attempt_count, locked_until")
    .eq("email", email)
    .maybeSingle();

  if (attempt?.locked_until && new Date(attempt.locked_until) > new Date()) {
    return NextResponse.json(
      { error: lockoutMessage(attempt.locked_until), locked: true },
      { status: 429 },
    );
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
      {
        error: justLocked ? lockoutMessage(lockedUntil!) : "Incorrect email or password.",
        locked: justLocked,
      },
      { status: justLocked ? 429 : 401 },
    );
  }

  // Unlike /api/admin/login (which defers the admin_users check to
  // requireAdmin() on the next page load), this checks staff_users
  // immediately and signs the session back out on any mismatch — the
  // concrete mechanism that guarantees admin credentials entered here
  // never grant staff access either: this route only ever checks
  // staff_users, never admin_users.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: staffRow } = await supabase
    .from("staff_users")
    .select("id")
    .eq("id", user!.id)
    .maybeSingle();

  if (!staffRow) {
    await supabase.auth.signOut();
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  await adminClient.from("login_attempts").delete().eq("email", email);

  return NextResponse.json({ ok: true });
}
