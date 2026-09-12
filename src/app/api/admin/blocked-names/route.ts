import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizeGuestName } from "@/lib/guest-blocklist";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() || null : null;

  if (!fullName || fullName.length > 200) {
    return NextResponse.json({ error: "Name is required (max 200 chars)." }, { status: 400 });
  }
  if (reason && reason.length > 500) {
    return NextResponse.json({ error: "Reason is too long (max 500 chars)." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("blocked_guest_names")
    .insert({
      full_name: fullName,
      full_name_normalized: normalizeGuestName(fullName),
      reason,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Not authorized, or could not add to the blocklist." },
      { status: 403 },
    );
  }

  return NextResponse.json({ ok: true, id: data.id });
}
