import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isAllowedOrigin, rpIdFromOrigin, CHALLENGE_TTL_MINUTES } from "@/lib/webauthn";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// Public — this is what the login page calls BEFORE any password is
// entered, to check whether biometric login is even possible on this
// device/browser. Returns { available: false } (never an error) when
// there's nothing to try, so the client falls back to the password form
// immediately rather than prompting a doomed WebAuthn ceremony.
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!isAllowedOrigin(origin)) {
    return NextResponse.json({ available: false });
  }

  const rateLimit = await checkRateLimit("passkey-login-options", getClientIp(request), {
    maxAttempts: 20,
    windowMinutes: 10,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json({ available: false });
  }

  const adminClient = createAdminSupabaseClient();

  const { data: credentials } = await adminClient
    .from("passkey_credentials")
    .select("credential_id, transports, admin_user_id");

  if (!credentials || credentials.length === 0) {
    return NextResponse.json({ available: false });
  }

  const rpID = rpIdFromOrigin(origin);

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: credentials.map((c) => ({
      id: c.credential_id,
      transports: c.transports ?? undefined,
    })),
    userVerification: "preferred",
  });

  // Single real admin account (same assumption staff_users and the
  // Jenga merchant config make elsewhere) -- every registered
  // credential belongs to the one admin, so any of them identifies the
  // right admin_user_id for the challenge row.
  const adminUserId = credentials[0].admin_user_id;

  await adminClient
    .from("passkey_challenges")
    .delete()
    .eq("admin_user_id", adminUserId)
    .lt("created_at", new Date(Date.now() - CHALLENGE_TTL_MINUTES * 60_000).toISOString());

  await adminClient.from("passkey_challenges").insert({
    admin_user_id: adminUserId,
    type: "authentication",
    challenge: options.challenge,
  });

  return NextResponse.json({ available: true, options });
}
