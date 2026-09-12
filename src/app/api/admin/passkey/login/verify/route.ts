import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isAllowedOrigin, rpIdFromOrigin, CHALLENGE_TTL_MINUTES } from "@/lib/webauthn";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// Public — completes the biometric login attempt. On success this
// mints a real Supabase session with no password involved: the same
// "verify server-side, then establish cookies via the SSR client" shape
// as /api/admin/recover/callback's PKCE exchange, just using
// generateLink + verifyOtp as the primitive instead of a code exchange.
// generateLink does NOT send an email — it only returns the token
// consumed immediately below, nothing goes out over the wire to anyone.
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!isAllowedOrigin(origin)) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 400 });
  }

  const rateLimit = await checkRateLimit("passkey-login-verify", getClientIp(request), {
    maxAttempts: 10,
    windowMinutes: 10,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Too many attempts. Please try again in ${rateLimit.retryAfterMinutes} minute${rateLimit.retryAfterMinutes === 1 ? "" : "s"}.` },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const response = body?.response;
  const credentialId: unknown = response?.id;
  if (!response || typeof credentialId !== "string" || credentialId.length > 500) {
    return NextResponse.json({ error: "Missing passkey response." }, { status: 400 });
  }

  const adminClient = createAdminSupabaseClient();

  const { data: credRow } = await adminClient
    .from("passkey_credentials")
    .select("id, admin_user_id, credential_id, public_key, counter, transports")
    .eq("credential_id", credentialId)
    .maybeSingle();

  if (!credRow) {
    return NextResponse.json({ error: "Unrecognized passkey." }, { status: 400 });
  }

  const { data: challengeRow } = await adminClient
    .from("passkey_challenges")
    .select("id, challenge, created_at")
    .eq("admin_user_id", credRow.admin_user_id)
    .eq("type", "authentication")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (
    !challengeRow ||
    Date.now() - new Date(challengeRow.created_at).getTime() > CHALLENGE_TTL_MINUTES * 60_000
  ) {
    return NextResponse.json({ error: "Login expired — please try again." }, { status: 400 });
  }

  const rpID = rpIdFromOrigin(origin);

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: credRow.credential_id,
        publicKey: isoBase64URL.toBuffer(credRow.public_key),
        counter: credRow.counter,
        transports: credRow.transports ?? undefined,
      },
    });
  } catch {
    return NextResponse.json({ error: "Could not verify passkey." }, { status: 400 });
  }

  // Single-use regardless of outcome.
  await adminClient.from("passkey_challenges").delete().eq("id", challengeRow.id);

  if (!verification.verified) {
    return NextResponse.json({ error: "Could not verify passkey." }, { status: 400 });
  }

  await adminClient
    .from("passkey_credentials")
    .update({
      counter: verification.authenticationInfo.newCounter,
      last_used_at: new Date().toISOString(),
    })
    .eq("id", credRow.id);

  const { data: adminRow } = await adminClient
    .from("admin_users")
    .select("email")
    .eq("id", credRow.admin_user_id)
    .maybeSingle();

  if (!adminRow) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email: adminRow.email,
  });

  if (linkError || !linkData?.properties?.hashed_token) {
    return NextResponse.json({ error: "Could not start session." }, { status: 500 });
  }

  const sessionClient = await createServerSupabaseClient();
  const { error: verifyOtpError } = await sessionClient.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "magiclink",
  });

  if (verifyOtpError) {
    return NextResponse.json({ error: "Could not start session." }, { status: 500 });
  }

  await adminClient.from("login_attempts").delete().eq("email", adminRow.email.toLowerCase());

  return NextResponse.json({ ok: true });
}
