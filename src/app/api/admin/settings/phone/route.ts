import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/phone";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { currentPhone, newPhone } = body ?? {};

  if (typeof currentPhone !== "string" || typeof newPhone !== "string") {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const normalizedCurrent = normalizePhone(currentPhone);
  const normalizedNew = normalizePhone(newPhone);
  if (!normalizedNew) {
    return NextResponse.json(
      { error: "Enter a valid new number with country code, e.g. +254712345678." },
      { status: 400 },
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("whatsapp_phone")
    .eq("id", user.id)
    .maybeSingle();

  if (!adminRow || normalizedCurrent !== adminRow.whatsapp_phone) {
    return NextResponse.json(
      { error: "Current phone number is incorrect." },
      { status: 401 },
    );
  }

  const { error: updateError } = await supabase
    .from("admin_users")
    .update({ whatsapp_phone: normalizedNew })
    .eq("id", user.id);

  if (updateError) {
    return NextResponse.json({ error: "Could not save number." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, whatsappPhone: normalizedNew });
}
