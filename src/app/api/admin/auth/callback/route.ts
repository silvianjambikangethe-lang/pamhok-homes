import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Landing point for the Google sign-in redirect (PKCE flow): exchanges
// the one-time `code` for a real session, then applies the same
// admin_users allowlist check as password login. Google sign-in only
// grants access because Supabase Auth automatically links a new OAuth
// identity to an existing user when the emails match
// (supabase.com/docs/guides/auth/auth-identity-linking#automatic-linking)
// — so signing in with the admin's real Google account lands on the
// SAME auth.users row the password login already uses. Any other Google
// account creates its own unlinked user with no admin_users row, and is
// rejected the same way an unrecognized password login would be.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/admin/login?error=not-authorized`);
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/admin/login?error=not-authorized`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/admin/login?error=not-authorized`);
  }

  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!adminRow) {
    return NextResponse.redirect(`${origin}/admin/login?error=not-authorized`);
  }

  return NextResponse.redirect(`${origin}/admin`);
}
