import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { hashPin, isValidPinFormat } from "@/lib/staff-pin";
import type { StaffMember } from "@/lib/supabase/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);

  if (typeof body?.name === "string" && body.name.trim().length > 100) {
    return NextResponse.json({ error: "Name is too long (max 100 chars)." }, { status: 400 });
  }
  if (typeof body?.pin === "string" && !isValidPinFormat(body.pin)) {
    return NextResponse.json({ error: "PIN must be 4-6 digits." }, { status: 400 });
  }

  const update: Partial<StaffMember> = {};
  if (typeof body?.name === "string") update.name = body.name.trim();
  if (typeof body?.active === "boolean") update.active = body.active;
  if (typeof body?.pin === "string") update.pin_hash = hashPin(body.pin);

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("staff_members")
    .update(update)
    .eq("id", id)
    .select("id");

  if (error) {
    return NextResponse.json({ error: "Could not update worker." }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Not authorized or worker not found." }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}

// Attempts a real, permanent delete of the worker's row (and with it,
// their pin_hash — the actual credential that made "being" this worker
// possible). shift_logs.staff_member_id is `on delete restrict`, so a
// worker with shift history can't be hard-deleted — that FK violation
// (Postgres 23503) is caught below and falls back to deactivating AND
// clearing pin_hash, which is the closest equivalent available: the
// worker's own tile disappears and their old PIN is permanently dead
// either way, just the row itself survives to satisfy the FK. The
// caller (BlockedGuestNamesForm's sibling, StaffMembersForm) uses
// `hardDeleted` to show which actually happened.
//
// Uses the service-role client for the delete attempt specifically so
// the FK-violation error code comes back cleanly to inspect, rather than
// RLS silently returning zero affected rows on a blocked delete (RLS
// membership is still checked via createServerSupabaseClient() first,
// same admin-only gate as PATCH above).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!adminRow) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const adminClient = createAdminSupabaseClient();

  const { error: deleteError } = await adminClient.from("staff_members").delete().eq("id", id);

  if (!deleteError) {
    return NextResponse.json({ ok: true, hardDeleted: true });
  }

  if (deleteError.code !== "23503") {
    return NextResponse.json({ error: "Could not delete worker." }, { status: 500 });
  }

  const { data, error: fallbackError } = await adminClient
    .from("staff_members")
    .update({ active: false, pin_hash: null })
    .eq("id", id)
    .select("id");

  if (fallbackError || !data || data.length === 0) {
    return NextResponse.json({ error: "Could not delete or deactivate worker." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, hardDeleted: false });
}
