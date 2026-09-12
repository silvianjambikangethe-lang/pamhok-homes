import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isAllowedOrigin, rpIdFromOrigin, CHALLENGE_TTL_MINUTES } from "@/lib/webauthn";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!isAllowedOrigin(origin)) {
    return NextResponse.json({ error: "Invalid origin." }, { status: 400 });
  }

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

  const body = await request.json().catch(() => null);
  const deviceName =
    typeof body?.deviceName === "string" && body.deviceName.trim()
      ? body.deviceName.trim().slice(0, 100)
      : null;
  if (!body?.response) {
    return NextResponse.json({ error: "Missing registration response." }, { status: 400 });
  }

  const adminClient = createAdminSupabaseClient();

  const { data: challengeRow } = await adminClient
    .from("passkey_challenges")
    .select("id, challenge, created_at")
    .eq("admin_user_id", adminRow.id)
    .eq("type", "registration")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (
    !challengeRow ||
    Date.now() - new Date(challengeRow.created_at).getTime() > CHALLENGE_TTL_MINUTES * 60_000
  ) {
    return NextResponse.json(
      { error: "Registration expired — please try again." },
      { status: 400 },
    );
  }

  const rpID = rpIdFromOrigin(origin);

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: challengeRow.challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch {
    return NextResponse.json({ error: "Could not verify passkey." }, { status: 400 });
  }

  // Single-use regardless of outcome, so a failed/retried attempt can't
  // be replayed against a stale challenge.
  await adminClient.from("passkey_challenges").delete().eq("id", challengeRow.id);

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "Could not verify passkey." }, { status: 400 });
  }

  const { credential } = verification.registrationInfo;

  const { error } = await adminClient.from("passkey_credentials").insert({
    admin_user_id: adminRow.id,
    credential_id: credential.id,
    public_key: isoBase64URL.fromBuffer(credential.publicKey),
    counter: credential.counter,
    device_name: deviceName,
    transports: credential.transports ?? null,
  });

  if (error) {
    return NextResponse.json({ error: "Could not save passkey." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
