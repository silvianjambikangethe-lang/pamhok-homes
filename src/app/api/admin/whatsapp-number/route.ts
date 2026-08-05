import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/lib/phone";

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);

  if (typeof body?.whatsappPhone !== "string") {
    return NextResponse.json({ error: "Missing phone number." }, { status: 400 });
  }

  const normalized = normalizePhone(body.whatsappPhone);
  if (!normalized) {
    return NextResponse.json(
      { error: "Enter a valid phone number with country code, e.g. +254712345678." },
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

  const { data, error } = await supabase
    .from("admin_users")
    .update({ whatsapp_phone: normalized })
    .eq("id", user.id)
    .select("id");

  if (error) {
    return NextResponse.json({ error: "Could not save number." }, { status: 500 });
  }
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  return NextResponse.json({ ok: true, whatsappPhone: normalized });
}
