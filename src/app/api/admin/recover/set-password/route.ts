import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// Sets a new password for a session established via the email-recovery
// link (see /api/admin/recover/callback) — deliberately does NOT ask for
// the current password, since the whole point of this path is recovering
// an account whose password was forgotten. Identity is instead proven by
// having a valid session that only exists because of the one-time code
// emailed to the registered admin address.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { newPassword, confirmNewPassword } = body ?? {};

  if (typeof newPassword !== "string" || typeof confirmNewPassword !== "string") {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }
  if (newPassword !== confirmNewPassword) {
    return NextResponse.json({ error: "New passwords don't match." }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "New password must be at least 8 characters." },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const adminClient = createAdminSupabaseClient();

  // Confirm admin_users membership via RLS before touching the
  // service-role client below, same as the regular change-password route.
  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("id")
    .eq("id", session.user.id)
    .maybeSingle();
  if (!adminRow) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const { error: updateError } = await adminClient.auth.admin.updateUserById(session.user.id, {
    password: newPassword,
  });
  if (updateError) {
    return NextResponse.json({ error: "Could not update password." }, { status: 500 });
  }

  // Unlock the account — the whole reason this path exists — and revoke
  // any other active sessions so a stale one elsewhere can't keep using
  // the old password's access.
  await adminClient.from("login_attempts").delete().eq("email", session.user.email.toLowerCase());
  try {
    await adminClient.auth.admin.signOut(session.access_token, "others");
  } catch {
    // Best-effort — the password change above already succeeded.
  }

  return NextResponse.json({ ok: true });
}
