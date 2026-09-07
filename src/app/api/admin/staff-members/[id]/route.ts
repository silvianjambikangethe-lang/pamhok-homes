import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { StaffMember } from "@/lib/supabase/types";

// No DELETE route on purpose: "removing" a worker means active: false,
// not a hard delete — shift_logs.staff_member_id is `on delete restrict`
// so a worker with shift history can't be hard-deleted anyway, and
// deactivating removes them from the tap list immediately with no
// password reset needed (see supabase/schema.sql's comment on
// staff_members).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);

  const update: Partial<StaffMember> = {};
  if (typeof body?.name === "string") update.name = body.name.trim();
  if (typeof body?.active === "boolean") update.active = body.active;

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
