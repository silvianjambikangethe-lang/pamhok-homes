import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isAllowedOrigin, rpIdFromOrigin, CHALLENGE_TTL_MINUTES } from "@/lib/webauthn";
import { SITE } from "@/lib/site";

// Step 1 of registering a new passkey for THIS device, from
// /admin/settings — requires an already-authenticated admin session
// (registering the first passkey has to happen via password login, same
// as any "add a second factor" flow elsewhere).
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
    .select("id, email")
    .eq("id", user.id)
    .maybeSingle();
  if (!adminRow) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  const adminClient = createAdminSupabaseClient();

  const { data: existing } = await adminClient
    .from("passkey_credentials")
    .select("credential_id, transports")
    .eq("admin_user_id", adminRow.id);

  const rpID = rpIdFromOrigin(origin);

  const options = await generateRegistrationOptions({
    rpName: SITE.name,
    rpID,
    userName: adminRow.email,
    userID: new TextEncoder().encode(adminRow.id),
    attestationType: "none",
    excludeCredentials: (existing ?? []).map((c) => ({
      id: c.credential_id,
      transports: c.transports ?? undefined,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
      authenticatorAttachment: "platform",
    },
  });

  await adminClient
    .from("passkey_challenges")
    .delete()
    .eq("admin_user_id", adminRow.id)
    .lt("created_at", new Date(Date.now() - CHALLENGE_TTL_MINUTES * 60_000).toISOString());

  await adminClient.from("passkey_challenges").insert({
    admin_user_id: adminRow.id,
    type: "registration",
    challenge: options.challenge,
  });

  return NextResponse.json(options);
}
