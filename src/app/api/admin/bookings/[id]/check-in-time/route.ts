import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// Sets or clears this one booking's check-in time override (see
// bookings.check_in_time_override) — e.g. pushing a guest's check-in to
// "2:00 PM" when cleaning ran long. Passing null clears it, back to the
// normal site-wide CHECK_IN_TIME.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);

  if (
    !body ||
    (body.checkInTimeOverride !== null && typeof body.checkInTimeOverride !== "string")
  ) {
    return NextResponse.json({ error: "Invalid check-in time." }, { status: 400 });
  }
  const value =
    typeof body.checkInTimeOverride === "string" ? body.checkInTimeOverride.trim().slice(0, 20) : null;

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("bookings")
    .update({ check_in_time_override: value || null })
    .eq("id", id)
    .select("id");

  if (error) {
    return NextResponse.json({ error: "Could not update check-in time." }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Not authorized or booking not found." }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
