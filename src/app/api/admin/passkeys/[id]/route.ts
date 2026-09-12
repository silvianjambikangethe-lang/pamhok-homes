import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

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

  // Scoped to admin_user_id so one admin can never delete another's
  // passkey by guessing an id — matches every other admin route in this
  // app scoping its `.eq("id", ...)` to the caller in some way.
  const { data, error } = await adminClient
    .from("passkey_credentials")
    .delete()
    .eq("id", id)
    .eq("admin_user_id", adminRow.id)
    .select("id");

  if (error) {
    return NextResponse.json({ error: "Could not remove passkey." }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Passkey not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
