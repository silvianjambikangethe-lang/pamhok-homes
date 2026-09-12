import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// Lists the current admin's own registered passkeys, for the "Passkeys"
// section in /admin/settings. Uses the service-role client for the read
// (passkey_credentials has no RLS policies at all, same reasoning as
// login_attempts — see the migration) but scopes the query to the
// caller's own admin_user_id first, so this can never leak another
// admin's device list even if more than one admin account ever exists.
export async function GET() {
  const authClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authorized." }, { status: 401 });

  const { data: adminRow } = await authClient
    .from("admin_users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!adminRow) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  const adminClient = createAdminSupabaseClient();
  const { data, error } = await adminClient
    .from("passkey_credentials")
    .select("id, device_name, created_at, last_used_at")
    .eq("admin_user_id", adminRow.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Could not load passkeys." }, { status: 500 });
  }

  return NextResponse.json({ passkeys: data ?? [] });
}
