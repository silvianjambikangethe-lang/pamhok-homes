import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hashPin, isValidPinFormat } from "@/lib/staff-pin";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const pin = typeof body?.pin === "string" ? body.pin : "";

  if (!name || name.length > 100) {
    return NextResponse.json({ error: "Name is required (max 100 chars)." }, { status: 400 });
  }
  if (!isValidPinFormat(pin)) {
    return NextResponse.json({ error: "PIN must be 4-6 digits." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("staff_members")
    .insert({ name, pin_hash: hashPin(pin) })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Not authorized, or could not add worker." },
      { status: 403 },
    );
  }

  return NextResponse.json({ ok: true, id: data.id });
}
