import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { currentPassword, newPassword, confirmNewPassword } = body ?? {};

  if (
    typeof currentPassword !== "string" ||
    typeof newPassword !== "string" ||
    typeof confirmNewPassword !== "string"
  ) {
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

  // Confirm admin_users membership via RLS before touching the
  // service-role client below — being merely a logged-in Supabase user
  // (e.g. if signups were ever enabled) isn't enough on its own.
  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("id")
    .eq("id", session.user.id)
    .maybeSingle();
  if (!adminRow) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  // Verify the current password via a throwaway client (not the cookie
  // session) so this check never disturbs the admin's active session.
  const verifyClient = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { error: verifyError } = await verifyClient.auth.signInWithPassword({
    email: session.user.email,
    password: currentPassword,
  });
  if (verifyError) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
  }

  const adminClient = createAdminSupabaseClient();
  const { error: updateError } = await adminClient.auth.admin.updateUserById(session.user.id, {
    password: newPassword,
  });
  if (updateError) {
    return NextResponse.json({ error: "Could not update password." }, { status: 500 });
  }

  // Best-effort: revoke every other active session for this admin so a
  // stale/stolen session elsewhere can't keep using the old password's
  // access. Never let this fail the response — the password change above
  // already succeeded and is the part that matters.
  try {
    await adminClient.auth.admin.signOut(session.access_token, "others");
  } catch {
    // Swallow — see comment above.
  }

  return NextResponse.json({ ok: true });
}
