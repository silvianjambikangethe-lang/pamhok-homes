import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// Self-service unlock for a locked-out (or simply forgotten-password) admin
// account. Always responds with the same generic message regardless of
// whether the email matches an admin, so this can't be used to enumerate
// admin accounts — the actual email is only ever sent if it matches a row
// in admin_users. Rate-limited per IP since it's unauthenticated.
const GENERIC_MESSAGE =
  "If that email is registered as an admin, a password reset link has been sent.";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const rateLimit = await checkRateLimit("admin-recover", getClientIp(request), {
    maxAttempts: 5,
    windowMinutes: 60,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${rateLimit.retryAfterMinutes} minute(s).` },
      { status: 429 },
    );
  }

  const adminClient = createAdminSupabaseClient();
  const { data: adminRow } = await adminClient
    .from("admin_users")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (adminRow) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const supabase = await createServerSupabaseClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/api/admin/recover/callback`,
    });
  }

  return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
}
