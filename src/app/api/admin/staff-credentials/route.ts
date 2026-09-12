import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// Edits the ONE shared staff_users account. No "current password"
// re-verification (unlike /api/admin/settings/password) — this isn't a
// self-service flow, it's the host changing someone else's login, and
// requireAdmin-style membership is already the gate below.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : undefined;
  const password = typeof body?.password === "string" ? body.password : undefined;

  if (!email && !password) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }
  if (email && email.length > 254) {
    return NextResponse.json({ error: "Email is too long." }, { status: 400 });
  }
  if (password && (password.length < 8 || password.length > 128)) {
    return NextResponse.json(
      { error: "Password must be 8-128 characters." },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  // Confirm admin_users membership via RLS before touching the
  // service-role client below — same pattern as
  // /api/admin/settings/password.
  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!adminRow) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const adminClient = createAdminSupabaseClient();

  const { data: staffRow } = await adminClient.from("staff_users").select("id").maybeSingle();
  if (!staffRow) {
    return NextResponse.json(
      { error: "No staff login exists yet — run scripts/bootstrap-staff.mjs first." },
      { status: 404 },
    );
  }

  const updates: { email?: string; password?: string } = {};
  if (email) updates.email = email;
  if (password) updates.password = password;

  const { error: updateError } = await adminClient.auth.admin.updateUserById(
    staffRow.id,
    updates,
  );
  if (updateError) {
    // Surface Supabase's actual reason (most commonly its password-strength
    // policy — "must contain lowercase, uppercase, a number, and a symbol")
    // instead of a generic message that gives the admin nothing to act on.
    return NextResponse.json({ error: updateError.message }, { status: 422 });
  }

  if (email) {
    await adminClient.from("staff_users").update({ email }).eq("id", staffRow.id);
  }

  // No separate explicit sign-out call here: Supabase Auth's admin
  // updateUserById revokes that user's existing refresh tokens as part
  // of a password change (standard GoTrue behavior, same as most auth
  // providers) — unlike /api/admin/settings/password's own explicit
  // signOut(token, "others") call, which exists there specifically to
  // revoke sessions OTHER than the caller's own; there's no "caller's
  // own session to preserve" here, since this is a different account.
  // This is the concrete mitigation for a lost/stolen shared staff
  // device: changing the password here signs it out everywhere. Verify
  // this in the browser test (log in as staff, change the password from
  // here, confirm the staff browser is signed out on its next request)
  // rather than trusting this comment alone.

  return NextResponse.json({ ok: true });
}
