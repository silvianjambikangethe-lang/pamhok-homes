import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Landing point for the link in the password-reset email (PKCE flow):
// exchanges the one-time `code` for a real session, setting the auth
// cookies server-side, then hands off to the set-new-password page. That
// page requires no current-password confirmation — arriving here with a
// valid code, sent only to the registered admin email, is the proof of
// identity for this recovery path.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/admin/recover?error=invalid-or-expired`);
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/admin/recover?error=invalid-or-expired`);
  }

  return NextResponse.redirect(`${origin}/admin/recover/set-password`);
}
